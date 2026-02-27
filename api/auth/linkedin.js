export default async function handler(req, res) {
    const { code } = req.query;

    if (!code) {
        return res.status(400).json({ error: 'Missing code' });
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
        console.error("CRITICAL: LinkedIn configuration missing");
        return res.status(500).json({ error: "Server configuration error: LinkedIn keys missing" });
    }

    try {
        // 1. Exchange code for access token
        const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
            }),
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            throw new Error(`LinkedIn Token Exchange Failed: ${tokenResponse.status} ${errorText}`);
        }

        const tokenData = await tokenResponse.json();
        if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

        // 2. Get user info (Basic Profile + Email via OpenID Connect)
        // Endpoint: https://api.linkedin.com/v2/userinfo
        const userInfoResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        if (!userInfoResponse.ok) {
            const errorText = await userInfoResponse.text();
            throw new Error(`LinkedIn UserInfo Fetch Failed: ${userInfoResponse.status} ${errorText}`);
        }

        const userInfo = await userInfoResponse.json();
        const { sub, name, given_name, family_name, picture, email } = userInfo;

        // Note: LinkedIn OIDC doesn't provide the vanitiy profile URL directly.
        // We'll return what we have and let the frontend handle fallback/UI.

        return res.status(200).json({
            sub,
            name: name || `${given_name} ${family_name}`,
            picture,
            email,
            token: tokenData.access_token // This is short-lived
        });

    } catch (error) {
        console.error("CRITICAL AUTH ERROR:", error);
        // Fail loudly by returning a 500 with the error message
        return res.status(500).json({
            error: "Authentication process failed critically.",
            details: error.message
        });
    }
}
