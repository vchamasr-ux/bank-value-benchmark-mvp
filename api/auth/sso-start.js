import {
    CENTRAL_ORIGIN,
    closeRedis,
    createOAuthState,
    createRedis,
    createSuiteTicket,
    normalizeReturnTo,
    readSession,
} from './_suite-sso.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    let redis;
    try {
        const returnTo = normalizeReturnTo(req.query.return_to, `${CENTRAL_ORIGIN}/`);
        redis = createRedis();
        const session = await readSession(req, redis);
        if (session) return res.redirect(302, await createSuiteTicket(redis, session.user, returnTo));

        const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
        const redirectUri = process.env.LINKEDIN_REDIRECT_URI?.trim();
        if (!clientId || !redirectUri) throw new Error('LinkedIn is not configured');

        const state = await createOAuthState(res, redis, {
            returnTo,
            consent: req.query.consent === '1',
        });
        const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
        authUrl.search = new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            redirect_uri: redirectUri,
            state,
            scope: 'openid profile email',
        }).toString();
        return res.redirect(302, authUrl.toString());
    } catch (error) {
        console.error('Suite SSO start failed:', error);
        return res.status(400).json({ error: 'Unable to start suite sign-in', details: error.message });
    } finally {
        await closeRedis(redis);
    }
}
