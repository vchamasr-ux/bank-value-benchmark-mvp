
import { getPeerGroupBenchmark } from './src/services/fdicService.js';

async function check(assetSize, label) {
    console.log(`\nTesting Asset Size: ${assetSize.toLocaleString()} (${label})`);
    try {
        const data = await getPeerGroupBenchmark(assetSize);
        if (data) {
            console.log(`✅ Group: "${data.groupName}"`);
            console.log(`   Sample Size: ${data.sampleSize}`);
            console.log(`   Peer Sample: ${data.peerBanks.slice(0, 3).map(b => b.name).join(', ')}...`);
        } else {
            console.log("❌ No data returned.");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

async function run() {
    // 1. Test massive bank (JP Morgan Chase is ~3.8 Trillion = 3,800,000,000 k)
    await check(3800000000, "JPM Chase (> $250B)");

    // 2. Test large regional (e.g. $100B)
    await check(100000000, "Large Regional ($100B)");

    // 3. Test mid-sized ($20B)
    await check(20000000, "Mid-Sized ($20B)");
}

run();
