import {
    anonymousReturnUrl,
    closeRedis,
    createRedis,
    createSuiteTicket,
    normalizeReturnTo,
    readSession,
} from './_suite-sso.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    let redis;
    try {
        const returnTo = normalizeReturnTo(req.query.return_to);
        redis = createRedis();
        const session = await readSession(req, redis);
        if (!session) return res.redirect(302, anonymousReturnUrl(returnTo));
        return res.redirect(302, await createSuiteTicket(redis, session.user, returnTo));
    } catch (error) {
        console.error('Suite SSO authorization failed:', error);
        return res.status(400).json({ error: 'Unable to authorize suite session', details: error.message });
    } finally {
        await closeRedis(redis);
    }
}
