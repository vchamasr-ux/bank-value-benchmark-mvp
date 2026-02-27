import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for existing session
        const storedUser = localStorage.getItem('auth_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);

        // Handle Auth Callback if on the callback route
        const handleCallback = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const state = urlParams.get('state');

            if (code && state) {
                const savedState = localStorage.getItem('auth_state');
                if (state !== savedState) {
                    console.error("Auth State Mismatch");
                    window.history.replaceState({}, document.title, window.location.pathname);
                    return;
                }

                try {
                    // 1. Exchange code for user data via our serverless function
                    const response = await fetch(`/api/auth/linkedin?code=${code}&state=${state}`);
                    const userData = await response.json();

                    if (userData.error) throw new Error(userData.error);

                    // 2. Fetch pending registration data (consent)
                    const pendingData = JSON.parse(localStorage.getItem('pending_registration') || '{}');

                    // 3. Complete registration / notify admin
                    const regResponse = await fetch('/api/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sub: userData.sub,
                            name: userData.name,
                            email: userData.email,
                            profileUrl: userData.profileUrl || `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(userData.name)}`, // Fallback search link if URL not provided
                            consent: pendingData.consent
                        })
                    });

                    const regData = await regResponse.json();

                    // 4. Set user and clean up
                    const userWithProfile = {
                        ...userData,
                        profileUrl: userData.profileUrl || `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(userData.name)}`
                    };
                    setUser(userWithProfile);
                    localStorage.setItem('auth_user', JSON.stringify(userWithProfile));

                    localStorage.removeItem('auth_state');
                    localStorage.removeItem('pending_registration');

                    // 5. Clean URL
                    window.history.replaceState({}, document.title, "/");
                } catch (err) {
                    console.error("Auth Callback Error:", err);
                    window.history.replaceState({}, document.title, "/");
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
    };

    return (
        <AuthContext.Provider value={{ user, loading, logout, login }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
