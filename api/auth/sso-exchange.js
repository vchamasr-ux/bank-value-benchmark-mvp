import { closeRedis, consumeSuiteTicket, createRedis, isAllowedSuiteOrigin } from './_suite-sso.js';

export default async function handler(req, res) {
    const origin = req.headers.origin || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    if (origin && isAllowedSuiteOrigin(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') return res.status(origin && isAllowedSuiteOrigin(origin) ? 204 : 403).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!origin || !isAllowedSuiteOrigin(origin)) return res.status(403).json({ error: 'Unapproved suite origin' });

    let redis;
    try {
        redis = createRedis();
        const payload = await consumeSuiteTicket(redis, req.body?.ticket);
        if (!payload) return res.status(401).json({ error: 'Ticket is missing, expired, or already used' });
        if (payload.audience !== origin) return res.status(403).json({ error: 'Ticket audience mismatch' });
        return res.status(200).json({ user: payload.user });
    } catch (error) {
        console.error('Suite SSO exchange failed:', error);
        return res.status(500).json({ error: 'Unable to exchange suite ticket' });
    } finally {
        await closeRedis(redis);
    }
}
