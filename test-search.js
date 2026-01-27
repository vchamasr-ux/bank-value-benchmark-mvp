import { searchBank } from './src/services/fdicService.js';

// Polyfill for Node environment if needed, though Node 24 has native fetch
// We'll trust the native fetch.

console.log("Testing Bank Search...");

async function runTest() {
    try {
        const results = await searchBank("First Community");
        console.log(`Found ${results.length} banks.`);
        if (results.length > 0) {
            console.log("First Result:", results[0]);
            console.log("✅ API Search Test Passed!");
        } else {
            console.error("❌ No results found.");
            process.exit(1);
        }
    } catch (error) {
        console.error("❌ Test Failed:", error);
        process.exit(1);
    }
}

runTest();
