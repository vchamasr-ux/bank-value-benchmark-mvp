import { calculateKPIs } from '../src/utils/kpiCalculator.js';

async function verifyAllMetrics() {
    console.log("Fetching live FDIC data for JPMorgan Chase (CERT 628)...");
    
    const fields = 'REPDTE,ASSET,DEP,NUMEMP,INTINC,INTEXP,EINTEXP,NONII,NONIX,LNLSNET,NETINC,EQ,NCLNLS,STALP,NAME,CITY,STNAME';
    const url = `https://api.fdic.gov/banks/financials/?filters=CERT:628&fields=${fields}&limit=20&sort_by=REPDTE&sort_order=DESC&format=json`;
    
    const res = await fetch(url);
    const json = await res.json();
    
    if (!json.data || json.data.length === 0) {
        console.error("FATAL: No data returned from FDIC");
        process.exit(1);
    }
    
    const rawHistory = json.data.map(item => item.data);
    
    console.log(`Successfully fetched ${rawHistory.length} quarters of data. Latest is ${rawHistory[0].REPDTE}.`);
    console.log("Calculating all KPIs...\n");
    
    try {
        const kpis = calculateKPIs(rawHistory);
        const latestMets = kpis[0];
        
        let foundErrors = false;
        
        console.log("--- KPI EXTRACTION EXACT VALUES ---");
        for (const [key, value] of Object.entries(latestMets)) {
            if (key === 'raw' || key === 'annualGrowthHistory' || key === 'reportDate') continue;
            
            let status = "✅ OK";
            if (value === null) {
                status = "❌ NULL ERROR";
                foundErrors = true;
            } else if (value === 0) {
                status = "❌ ZERO ERROR";
                foundErrors = true;
            } else if (Number.isNaN(value)) {
                status = "❌ NaN ERROR";
                foundErrors = true;
            } else if (!isFinite(value)) {
                status = "❌ INFINITY ERROR";
                foundErrors = true;
            }
            
            console.log(`${key.padEnd(25)} : ${String(value).padEnd(20)} ${status}`);
        }
        
        console.log("\n--- RAW METRICS ---");
        for (const [key, value] of Object.entries(latestMets.raw)) {
            let status = "✅ OK";
            if (value === null) {
                status = "❌ NULL ERROR";
                foundErrors = true;
            } else if (Number(value) === 0) {
                // Ignore strings that evaluate to 0, check real numbers
                if (typeof value === 'number' || !isNaN(parseFloat(value))) {
                    status = "❌ ZERO ERROR";
                    foundErrors = true;
                }
            }
            console.log(`${key.padEnd(25)} : ${String(value).padEnd(20)} ${status}`);
        }
        
        if (foundErrors) {
            console.error("\n[!] CRITICAL: Garbage / Null / Zero values detected in live pipeline!");
            process.exit(1);
        } else {
            console.log("\n[SUCCESS] No nulls, no zeros, no NaNs detected across any metric.");
        }
        
    } catch (e) {
        console.error("CRITICAL FAILURE DURING KPI CALCULUS:", e.message);
        process.exit(1);
    }
}

verifyAllMetrics();
