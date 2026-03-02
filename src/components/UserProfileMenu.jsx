import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from './auth/AuthContext';
import SavedBriefsModal from './SavedBriefsModal';

const UserProfileMenu = () => {
    const { user, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [isBriefsModalOpen, setIsBriefsModalOpen] = useState(false);
    const menuRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    if (!user) return null;

    // Helper to get initials if picture is missing
    const getInitials = (name) => {
        if (!name) return 'U';
        return name.split(' ')
            .map(n => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();
    };

    return (
        <div className="relative" ref={menuRef}>
            {/* Avatar Trigger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 border-2 border-transparent hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all overflow-hidden"
                title={`${user.name}'s Profile`}
            >
                {user.picture ? (
                    <img
                        src={user.picture}
                        alt={`${user.name}'s Avatar`}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <span className="text-sm font-bold text-slate-600">
                        {getInitials(user.name)}
                    </span>
                )}
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white/95 backdrop-blur-xl rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/20 overflow-hidden z-[200] animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* User Info Header */}
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                        <p className="font-bold text-slate-900 truncate">{user.name}</p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{user.email || 'Authenticated User'}</p>
                    </div>

                    <div className="p-2 space-y-1">
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                setIsBriefsModalOpen(true);
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-600 hover:text-blue-700 hover:bg-slate-50/80 rounded-lg transition-colors text-left"
                        >
                            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                            My Saved Briefs
                        </button>

                        {user.profileUrl && (
                            <a
                                href={user.profileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-600 hover:text-blue-700 hover:bg-slate-50/80 rounded-lg transition-colors text-left"
                            >
                                <svg className="w-4 h-4 text-[#0077b5]" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.761 0 5-2.239 5-5v-14c0-2.761-2.239-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                                </svg>
                                LinkedIn Profile
                                <svg className="w-3 h-3 ml-auto opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        )}

                        <div className="h-px bg-slate-100 my-1"></div>

                        <button
                            onClick={() => {
                                setIsOpen(false);
                                logout();
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 font-medium rounded-lg transition-colors text-left"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Sign Out
                        </button>
                    </div>
                </div>
            )}

            <SavedBriefsModal isOpen={isBriefsModalOpen} onClose={() => setIsBriefsModalOpen(false)} />
        </div>
    );
};

export default UserProfileMenu;
