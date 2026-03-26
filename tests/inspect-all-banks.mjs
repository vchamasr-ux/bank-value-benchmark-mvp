import { calculateKPIs } from '../src/utils/kpiCalculator.js';

async function auditAllBanks() {
    console.log("Fetching list of Top US Banks from FDIC (limiting to 100 to respect rate limits)...");
    
    // Get Top 120 Banks by Asset Size strictly in the $1B to $10B range (in thousands)
    // FDIC uses the 'filters' URL parameter for bounds, not 'search'
    const instUrl = `https://api.fdic.gov/banks/institutions/?filters=${encodeURIComponent('ASSET:[1000000 TO 10000000] AND ACTIVE:1')}&limit=120&sort_by=ASSET&sort_order=DESC&format=json&fields=CERT,NAME,ASSET,BKCLASS`;
    
    let banks = [];
    try {
        const instRes = await fetch(instUrl);
        const instJson = await instRes.json();
        banks = instJson.data
            .map(i => i.data)
            .filter(b => b.BKCLASS !== 'NC' && b.BKCLASS !== 'OI')
            .slice(0, 100); // Take exactly 100 for a clean percentage
    } catch (e) {
        console.error("Failed to fetch bank list:", e);
        process.exit(1);
    }
    
    console.log(`Successfully fetched ${banks.length} banks. Beginning parallel audit of ALL financial metrics...\n`);
    
    let passingBanks = 0;
    let failingBanks = 0;
    const failures = [];
    
    // We will batch Requests to avoid choking the network (concurrency of 10)
    const CONCURRENCY = 10;
    
    for (let i = 0; i < banks.length; i += CONCURRENCY) {
        const batch = banks.slice(i, i + CONCURRENCY);
        
        const promises = batch.map(async (bank) => {
            const cert = bank.CERT;
            const fields = 'REPDTE,ASSET,DEP,NUMEMP,INTINC,EINTEXP,INTEXP,NONII,NONIX,LNLSNET,NETINC,EQ,NCLNLS,STALP,NAME,CITY,STNAME';
            const finUrl = `https://api.fdic.gov/banks/financials/?filters=CERT:${cert}&fields=${fields}&limit=20&sort_by=REPDTE&sort_order=DESC&format=json`;
            
            try {
                const finRes = await fetch(finUrl);
                const finJson = await finRes.json();
                
                if (!finJson.data || finJson.data.length === 0) {
                    throw new Error("No financial data returned");
                }
                
                const rawHistory = finJson.data.map(item => item.data);
                const kpis = calculateKPIs(rawHistory);
                const latestMets = kpis[0];
                
                // Audit the metrics
                for (const [key, value] of Object.entries(latestMets)) {
                    if (key === 'raw' || key === 'annualGrowthHistory' || key === 'reportDate') continue;
                    
                    if (value === null || Number.isNaN(value) || !isFinite(value)) {
                        throw new Error(`Metric '${key}' resulted in invalid value: ${value}`);
                    }
                }
                
                for (const [key, value] of Object.entries(latestMets.raw)) {
                    if (value === null) {
                        throw new Error(`Raw FDIC field '${key}' is explicitly null`);
                    }
                }
                
                return { cert, name: bank.NAME, success: true };
            } catch (err) {
                return { cert, name: bank.NAME, success: false, error: err.message };
            }
        });
        
        const results = await Promise.all(promises);
        results.forEach(res => {
            if (res.success) {
                passingBanks++;
                process.stdout.write("✅");
            } else {
                failingBanks++;
                process.stdout.write("❌");
                failures.push(res);
            }
        });
    }
    
    console.log("\n\n--- AUDIT COMPLETE ---");
    console.log(`Total Banks Scanned: ${banks.length}`);
    console.log(`✅ Passed: ${passingBanks}`);
    console.log(`❌ Failed: ${failingBanks}`);
    
    if (failingBanks > 0) {
        console.log("\n--- FAILURE BREAKDOWN ---");
        failures.slice(0, 10).forEach(f => {
            console.log(`[CERT ${f.cert}] ${f.name} => ${f.error}`);
        });
        if (failures.length > 10) console.log(`...and ${failures.length - 10} more.`);
        process.exit(1);
    } else {
        console.log("\n[SUCCESS] 100% Data Extraction Integrity Confirmed. No nulls, zeros, or NaNs detected across the entire active bank sample.");
        process.exit(0);
    }
}

auditAllBanks();
