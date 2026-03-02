import { Redis } from 'ioredis';

const kv = new Redis(process.env.REDIS_URL);

export default async function handler(req, res) {
    const linkedinSub = req.headers['x-linkedin-sub'];

    if (!linkedinSub) {
        return res.status(401).json({ error: "Authentication required" });
    }

    if (!process.env.REDIS_URL) {
        console.error("CRITICAL ERROR: REDIS_URL is missing from environment.");
        return res.status(500).json({ error: 'Server configuration error: Redis is not configured. Missing REDIS_URL credentials.' });
    }

    const briefsKey = `briefs:${linkedinSub}`;

    // GET /api/briefs - Retrieve all saved briefs for the user
    if (req.method === 'GET') {
        try {
            const briefsObj = await kv.hgetall(briefsKey);

            if (!briefsObj) {
                return res.status(200).json({ briefs: [] });
            }

            // Convert to array, parse JSON strings, and sort by date descending
            const briefsArray = Object.values(briefsObj)
                .map(str => {
                    try { return JSON.parse(str); }
                    catch { return null; }
                })
                .filter(Boolean)
                .sort((a, b) => {
                    return new Date(b.date).getTime() - new Date(a.date).getTime();
                });

            return res.status(200).json({ briefs: briefsArray });
        } catch (error) {
            console.error("Failed to fetch saved briefs:", error);
            return res.status(500).json({ error: "Storage error: Failed to retrieve saved briefs" });
        }
    }

    // POST /api/briefs - Save a new brief
    if (req.method === 'POST') {
        try {
            const { bankName, type, data } = req.body;

            if (!bankName || !type || !data) {
                return res.status(400).json({ error: "Missing required fields: bankName, type, data" });
            }

            const briefId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9);
            const date = new Date().toISOString();

            const briefRecord = {
                id: briefId,
                bankName,
                type,
                date,
                data
            };

            await kv.hset(briefsKey, briefId, JSON.stringify(briefRecord));

            return res.status(200).json({ message: "Brief saved successfully", briefId });
        } catch (error) {
            console.error("Failed to save brief:", error);
            return res.status(500).json({ error: "Storage error: Failed to save brief" });
        }
    }

    // DELETE /api/briefs - Optional: delete a brief
    if (req.method === 'DELETE') {
        try {
            const { briefId } = req.body;
            if (!briefId) {
                return res.status(400).json({ error: "Missing briefId" });
            }

            await kv.hdel(briefsKey, briefId);
            return res.status(200).json({ message: "Brief deleted successfully" });
        } catch (error) {
            console.error("Failed to delete brief:", error);
            return res.status(500).json({ error: "Storage error: Failed to delete brief" });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
