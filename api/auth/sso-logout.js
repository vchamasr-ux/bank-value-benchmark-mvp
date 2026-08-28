import { clearCookie, closeRedis, createRedis, normalizeReturnTo, parseCookies, SESSION_COOKIE } from './_suite-sso.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    let redis;
    try {
        const returnTo = new URL(normalizeReturnTo(req.query.return_to));
        redis = createRedis();
        const sessionId = parseCookies(req)[SESSION_COOKIE];
        if (sessionId) await redis.del(`suite:sso:session:${sessionId}`);
        clearCookie(res, SESSION_COOKIE);
        returnTo.searchParams.set('sso_logged_out', '1');
        return res.redirect(302, returnTo.toString());
    } catch (error) {
        console.error('Suite SSO logout failed:', error);
        return res.status(400).json({ error: 'Unable to sign out of suite', details: error.message });
    } finally {
        await closeRedis(redis);
    }
}
