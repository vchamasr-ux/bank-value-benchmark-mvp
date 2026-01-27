import { getBankFinancials } from './src/services/fdicService.js';
import { calculateKPIs } from './src/utils/kpiCalculator.js';
import fs from 'fs';

console.log("Testing Financial Data Fetching...");

// Known CERT from previous test: 10595 (First Community Bank, Butler, MO)
const TEST_CERT = '10595';

async function runTest() {
    try {
        console.log(`Fetching financials for CERT: ${TEST_CERT}...`);
        const data = await getBankFinancials(TEST_CERT);

        // Remove direct fetch and use service
        // const url = ...
        // const response = ...

        if (data) {
            console.log("✅ Raw Data Received Keys:", Object.keys(data));
            fs.writeFileSync('debug_output.txt', JSON.stringify(data, null, 2));
            console.log("✅ Written raw data to debug_output.txt");

            const kpis = calculateKPIs(data);
            console.log("✅ Calculated KPIs:", kpis);

            // Basic sanity checks
            if (kpis.efficiencyRatio === "0.00" && kpis.costOfFunds === "0.00") {
                console.warn("⚠️ Warning: KPIs are all zero. Check if raw data fields match expected keys.");
            }
        } else {
            console.error("❌ No financial data found for this CERT.");
            process.exit(1);
        }
    } catch (error) {
        console.error("❌ Test Failed:", error);
        process.exit(1);
    }
}

runTest();
