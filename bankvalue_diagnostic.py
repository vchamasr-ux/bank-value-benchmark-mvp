import urllib.request
import json
import statistics

def fetch_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode('utf-8'))

def calc_kpis(b):
    ast = float(b.get('ASSET') or 0)
    if ast == 0: return None
    
    rep_date = str(b.get('REPDTE') or '20251231')
    try:
        month = int(rep_date[4:6])
    except:
        month = 12
        
    ann = 12 / month if month else 1.0

    exp = (float(b.get('INTEXP') or b.get('EINTEXP') or 0)) * ann
    inc = (float(b.get('INTINC') or 0)) * ann
    nii = inc - exp
    nonii = (float(b.get('NONII') or 0)) * ann
    nonix = (float(b.get('NONIX') or 0)) * ann
    net = (float(b.get('NETINC') or 0)) * ann
    
    ti = nii + nonii
    eff = (nonix / ti * 100) if ti > 0 else 0
    nim = (nii / ast * 100)
    roa = (net / ast * 100)
    rev_assets = (ti / ast * 100)
    
    return {
        'name': b.get('NAME'),
        'cert': b.get('CERT'),
        'st': b.get('STALP'),
        'city': b.get('CITY'),
        'assets': ast,
        'eff': eff,
        'nim': nim,
        'roa': roa,
        'rev_assets': rev_assets,
        'ti': ti,
        'nonix': nonix,
        'net': net
    }

def main():
    print("1. Scanning FDIC for a prime diagnostic candidate ($1B - $5B Assets, 2025 Data)...")
    # Using financials endpoint to ensure we get INCOME and EXPENSE fields for 2025
    url = 'https://banks.data.fdic.gov/api/financials?filters=ASSET:[1000000%20TO%205000000]%20AND%20REPDTE:20251231&fields=CERT,NAME,CITY,STALP,ASSET,NONIX,NONII,INTINC,INTEXP,EINTEXP,NETINC,REPDTE&limit=1000'
    data = fetch_json(url)

    candidates = []
    for d in data['data']:
        kpi = calc_kpis(d['data'])
        if not kpi: continue
        
        # We want a bank that is a "great engine, terrible overhead"
        if kpi['nim'] > 2.8 and 75 < kpi['eff'] < 95 and kpi['roa'] > 0.0:
            candidates.append(kpi)

    print(f"   -> Analyzed {len(data['data'])} banks.")
    candidates.sort(key=lambda x: x['eff'], reverse=True)
    if not candidates:
        print("Could not find a prime candidate.")
        return
        
    target = candidates[0]
    print(f"   -> Selected: {target['name']} ({target['city']}, {target['st']}) - Assets: ${target['assets']/1000:.1f}M")

    print(f"\n2. Fetching 2025 Peer Group (State: {target['st']}, Assets: 50% to 200%)...")
    min_ast = int(target['assets'] * 0.5)
    max_ast = int(target['assets'] * 2.0)
    peer_url = f"https://banks.data.fdic.gov/api/financials?filters=STALP:{target['st']}%20AND%20ASSET:[{min_ast}%20TO%20{max_ast}]%20AND%20REPDTE:20251231&fields=CERT,NAME,ASSET,NONIX,NONII,INTINC,INTEXP,EINTEXP,NETINC,REPDTE&limit=100"
    peer_data = fetch_json(peer_url)

    peers = []
    for d in peer_data['data']:
        if d['data'].get('CERT') == target['cert']: continue
        pkpi = calc_kpis(d['data'])
        if pkpi: peers.append(pkpi)

    # Fallback to national if too few in-state
    if len(peers) < 5:
        print("   -> Not enough peers in state, expanding nationally...")
        peer_url_nat = f"https://banks.data.fdic.gov/api/financials?filters=ASSET:[{int(target['assets']*0.8)}%20TO%20{int(target['assets']*1.2)}]%20AND%20REPDTE:20251231&fields=CERT,NAME,ASSET,NONIX,NONII,INTINC,INTEXP,EINTEXP,NETINC,REPDTE&limit=50"
        peer_data = fetch_json(peer_url_nat)
        for d in peer_data['data']:
            if d['data'].get('CERT') == target['cert']: continue
            pkpi = calc_kpis(d['data'])
            if pkpi: peers.append(pkpi)

    peer_effs = [p['eff'] for p in peers if p['eff'] > 0]
    peer_nims = [p['nim'] for p in peers]
    peer_roas = [p['roa'] for p in peers]
    peer_revs = [p['rev_assets'] for p in peers]

    if not peer_effs: return

    avg_eff = statistics.median(peer_effs)
    
    # Calculate P75 NIM (75th percentile)
    try:
        p75_nim = statistics.quantiles(peer_nims, n=4)[2]
    except:
        p75_nim = max(peer_nims)
        
    avg_roa = statistics.mean(peer_roas)
    avg_rev = statistics.mean(peer_revs)

    print(f"   -> Found {len(peers)} comparable peers.")

    print("\n" + "="*70)
    print(f"     BANKVALUE DIAGNOSTIC REPORT: {target['name'].upper()}")
    print("="*70)

    print("\n[PHASE 1: COMPETITOR RADAR (Identify the Outlier)]")
    print("Visual: Scatterplot of Revenue Generation (X) vs Profitability (Y)")
    print(f" * Peer Average    : Revenue = {(avg_rev):.2f}% of Assets | ROA = {avg_roa:.2f}%")
    print(f" * {target['name'][:15]:15}: Revenue = {(target['rev_assets']):.2f}% of Assets | ROA = {target['roa']:.2f}%")
    if target['rev_assets'] > avg_rev and target['roa'] < avg_roa:
        print(" * DIAGNOSIS: Outlier located. The bank generates MORE revenue than peers, but retains LESS profit.")

    print("\n[PHASE 2: BENCHMARK GAUGES (Diagnose the Flaw)]")
    print("Visual: Dashboard Gauges comparing Key Metrics vs Peers")
    nim_status = "GREEN (Strong Core Engine)" if target['nim'] >= p75_nim else "YELLOW (Average)"
    print(f" * Engine Check (NIM) : {target['nim']:.2f}%  (Top Quartile threshold is {p75_nim:.2f}%) -> Status: {nim_status}")
    print(f" * Overhead (Eff)     : {target['eff']:.1f}%  (Peer Average is {avg_eff:.1f}%) -> Status: RED (Massive Expense Bloat)")
    print(" * DIAGNOSIS: The core banking engine is fantastic, but overhead is consuming the profits.")

    print("\n[PHASE 3: STRATEGIC PLANNER (Prescribe the Fix)]")
    print("Visual: 'What I Need To Do' Interactive Slider")
    target_exp = (avg_eff / 100) * target['ti']
    cut_needed = target['nonix'] - target_exp
    new_net = target['net'] + cut_needed
    new_roa = (new_net / target['assets']) * 100

    print(f" * Current Efficiency : {target['eff']:.1f}%")
    print(f" * Target Efficiency  : {avg_eff:.1f}% (Peer Average)")
    print(f" * REQUIRED ACTION    : Cut ${(cut_needed):,.0f} in non-interest expense (overhead).")
    print(f" * PROJECTED IMPACT   : ROA increases from {target['roa']:.2f}% -> {new_roa:.2f}% (Becoming a Top-Tier Operator).")
    print("="*70 + "\n")

if __name__ == '__main__':
    main()
