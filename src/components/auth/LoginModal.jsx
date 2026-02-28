import React, { useState } from 'react';


const LoginModal = ({ isOpen, onClose }) => {
    const [consent, setConsent] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleLinkedInSignIn = async () => {
        const clientId = import.meta.env.VITE_LINKEDIN_CLIENT_ID;

        if (!clientId) {
            console.error("CRITICAL: VITE_LINKEDIN_CLIENT_ID is missing in .env");
            setError('System configuration error: LinkedIn integration is not configured. Please contact support.');
            return;
        }

        if (!consent) {
            setError('Please check the consent box to continue.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        // Save metadata to local storage so we can retrieve it after the redirect
        localStorage.setItem('pending_registration', JSON.stringify({
            consent
        }));

        // LinkedIn OAuth Configuration
        let origin = window.location.origin;
        // Force HTTPS in production to match LinkedIn whitelist exactly
        if (origin.includes('vercel.app') || (!origin.includes('localhost') && origin.startsWith('http://'))) {
            origin = origin.replace('http://', 'https://');
        }
        const redirectUri = `${origin}/auth/callback`;
        const state = Math.random().toString(36).substring(7);
        localStorage.setItem('auth_state', state);

        const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=openid%20profile%20email`;

        window.location.href = authUrl;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity"
                onClick={onClose}
            ></div>

            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
                {/* Header Decor */}
                <div className="h-2 bg-gradient-to-r from-[#0077b5] to-[#00a0dc]"></div>

                <div className="p-8">
                    <div className="flex flex-col items-center text-center mb-8">
                        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 border border-blue-100 shadow-sm transition-transform hover:scale-110 duration-300">
                            <svg className="w-8 h-8 text-[#0077b5]" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.761 0 5-2.239 5-5v-14c0-2.761-2.239-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900">Sign in with LinkedIn</h2>
                        <p className="text-slate-500 mt-2 text-sm">Access professional-grade financial analysis and benchmark data.</p>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex items-center h-5">
                                <input
                                    id="consent"
                                    type="checkbox"
                                    className="w-5 h-5 rounded border-slate-300 text-[#0077b5] focus:ring-[#0077b5] cursor-pointer accent-[#0077b5]"
                                    checked={consent}
                                    onChange={(e) => setConsent(e.target.checked)}
                                />
                            </div>
                            <label htmlFor="consent" className="text-xs text-slate-600 leading-normal cursor-pointer select-none">
                                I agree to share my basic profile and connect for a professional follow-up regarding this dashboard.
                            </label>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs font-medium flex items-center gap-2 animate-shake">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleLinkedInSignIn}
                            disabled={isSubmitting}
                            className="w-full py-4 px-6 bg-[#0077b5] hover:bg-[#006399] text-white font-bold rounded-xl shadow-lg shadow-blue-500/10 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98] ring-offset-2 focus:ring-2 focus:ring-[#0077b5]"
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.761 0 5-2.239 5-5v-14c0-2.761-2.239-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                                    </svg>
                                    Sign in with LinkedIn
                                </>
                            )}
                        </button>


                        <p className="text-center text-[10px] text-slate-400">
                            Your data is secured and will not be shared. 2 AI reports per day limit applies.
                        </p>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default LoginModal;
