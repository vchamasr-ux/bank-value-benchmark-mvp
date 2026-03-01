import { Redis } from 'ioredis';

// Automatically loads REDIS_URL if using --env-file
const client = new Redis(process.env.REDIS_URL);

async function main() {
    try {
        console.log("Checking RedisLabs connection via ioredis...");
        const testKey = 'test_connection_' + Date.now();

        // Write
        console.log(`Setting key: ${testKey}`);
        await client.set(testKey, JSON.stringify({ status: "success", timestamp: Date.now() }), 'EX', 60);

        // Read
        console.log(`Reading key: ${testKey}`);
        const val = await client.get(testKey);
        const parsed = JSON.parse(val);

        if (parsed && parsed.status === "success") {
            console.log("\n✅ RedisLabs connection is working perfectly!");
            console.log("Returned value:", parsed);
        } else {
            console.log("❌ Failed to retrieve the correct value.");
        }
    } catch (e) {
        console.error("❌ RedisLabs connection failed!");
        console.error(e);
    } finally {
        client.disconnect();
    }
}

main();
