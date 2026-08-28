import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [callbackLoading, setCallbackLoading] = useState(false);

    useEffect(() => {
        // Check for existing session
        const storedUser = localStorage.getItem('auth_user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch {
                // Malformed localStorage — fail loudly by removing it and forcing re-auth
                console.error('AuthContext: malformed auth_user in localStorage. Clearing and requiring re-login.');
                localStorage.removeItem('auth_user');
            }
        }
        setLoading(false);

        // Handle Auth Callback if on the callback route
        const handleCallback = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const state = urlParams.get('state');
            const ticket = urlParams.get('sso_ticket');

            if (urlParams.get('sso_logged_out') === '1') {
                localStorage.removeItem('auth_user');
                setUser(null);
                window.history.replaceState({}, document.title, window.location.pathname);
                return;
            }

            if (ticket) {
                setCallbackLoading(true);
                try {
                    const response = await fetch('/api/auth/sso-exchange', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ticket }),
                    });
                    const data = await response.json();
                    if (!response.ok || !data.user) throw new Error(data.error || 'Suite sign-in could not be completed');
                    setUser(data.user);
                    localStorage.setItem('auth_user', JSON.stringify(data.user));
                    window.history.replaceState({}, document.title, window.location.pathname);
                } catch (error) {
                    console.error('Suite ticket exchange failed:', error);
                } finally {
                    setCallbackLoading(false);
                }
                return;
            }

            if (code && state) {
                setCallbackLoading(true); // Block rendering while OAuth resolves
                try {
                    // 1. Exchange code for user data via our serverless function
                    const response = await fetch(`/api/auth/linkedin?code=${code}&state=${state}`);
                    const userData = await response.json();

                    if (userData.error) throw new Error(userData.error);

                    // 2. Set user and clean up. First-login monitoring now runs
                    // inside the trusted server callback rather than accepting
                    // browser-supplied identity data at /api/register.
                    const { continueUrl, consent: _consent, ...safeUserData } = userData;
                    const userWithProfile = {
                        ...safeUserData,
                        profileUrl: userData.profileUrl || `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(userData.name)}`
                    };
                    setUser(userWithProfile);
                    localStorage.setItem('auth_user', JSON.stringify(userWithProfile));

                    localStorage.removeItem('pending_registration');

                    // 3. Continue to the requesting suite app, or clean the local URL.
                    if (continueUrl) {
                        window.location.replace(continueUrl);
                    } else {
                        window.history.replaceState({}, document.title, "/");
                    }
                } catch (err) {
                    console.error("Auth Callback Error:", err);
                    // Never leave an older local profile visible after the current
                    // server-side OAuth exchange has failed. That would make the UI
                    // look signed in even though no shared suite session exists.
                    localStorage.removeItem('auth_user');
                    setUser(null);
                    window.history.replaceState({}, document.title, "/");
                } finally {
                    setCallbackLoading(false); // Always unblock, even on error
                }
            }
        };

        handleCallback();
    }, []);

    const login = (userData) => {
        setUser(userData);
        localStorage.setItem('auth_user', JSON.stringify(userData));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('auth_user');
        const returnTo = `${window.location.origin}/`;
        window.location.href = `/api/auth/sso-logout?return_to=${encodeURIComponent(returnTo)}`;
    };

    return (
        <AuthContext.Provider value={{ user, loading, callbackLoading, logout, login }}>
            {callbackLoading ? (
                <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-10 h-10 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                        <p className="text-slate-400 text-sm font-semibold tracking-wide">Completing sign-in…</p>
                    </div>
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);


