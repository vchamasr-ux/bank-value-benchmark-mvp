import React, { useState, useEffect, useRef, useCallback } from 'react';
import { searchBank } from '../services/fdicService';

// #3 — Debounced live search (300ms) so results appear as the user types
const DEBOUNCE_MS = 300;

// ─── Match Highlighter ────────────────────────────────────────────────────────
// Boldens the part of `text` that matches `query` — WCAG safe: uses bold not
// color-alone to convey the distinction.
function HighlightMatch({ text, query }) {
    if (!query || !text) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <>{text}</>;
    return (
        <>
            {text.slice(0, idx)}
            <mark className="bg-transparent font-bold text-blue-600 not-italic">
                {text.slice(idx, idx + query.length)}
            </mark>
            {text.slice(idx + query.length)}
        </>
    );
}

// ─── Search Icon SVG ──────────────────────────────────────────────────────────
function SearchIcon({ className }) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="8.5" cy="8.5" r="5.25" />
            <line x1="12.5" y1="12.5" x2="17" y2="17" />
        </svg>
    );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-8 text-center animate-fadeSlideIn">
            <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mb-3">
                <svg
                    aria-hidden="true"
                    className="w-6 h-6 text-slate-500"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <circle cx="8.5" cy="8.5" r="5.25" />
                    <line x1="12.5" y1="12.5" x2="17" y2="17" />
                    <line x1="8.5" y1="6" x2="8.5" y2="11" />
                    <circle cx="8.5" cy="12.5" r="0.5" fill="currentColor" />
                </svg>
            </div>
            <p className="text-sm font-semibold text-slate-300">No banks found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-[200px] leading-relaxed">
                Check your spelling or try a broader name like &ldquo;First National&rdquo;
            </p>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const BankSearch = ({ onBankSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [resultsVisible, setResultsVisible] = useState(false);
    const [recentBank, setRecentBank] = useState(() => {
        try {
            const saved = localStorage.getItem('recent_bank');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });
    const debounceRef = useRef(null);
    const inputRef = useRef(null);

    // ── Global hotkey: "/" to focus, Escape to clear ──────────────────────────
    useEffect(() => {
        const handleGlobalKey = (e) => {
            const tag = document.activeElement?.tagName;
            if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
                e.preventDefault();
                inputRef.current?.focus();
            }
            if (e.key === 'Escape' && document.activeElement === inputRef.current) {
                setSearchTerm('');
                setResults([]);
                setHasSearched(false);
                inputRef.current?.blur();
            }
        };
        window.addEventListener('keydown', handleGlobalKey);
        return () => window.removeEventListener('keydown', handleGlobalKey);
    }, []);

    // ── Debounced live search ─────────────────────────────────────────────────
    useEffect(() => {
        if (!searchTerm.trim()) {
            setResults([]);
            setHasSearched(false);
            setResultsVisible(false);
            return;
        }
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            setError(null);
            setHasSearched(true);
            try {
                const banks = await searchBank(searchTerm);
                setResults(banks);
                // Tiny delay so the element mounts before the animation class applies
                requestAnimationFrame(() => setResultsVisible(true));
            } catch {
                setError('Failed to fetch banks. Please try again.');
            } finally {
                setLoading(false);
            }
        }, DEBOUNCE_MS);

        return () => clearTimeout(debounceRef.current);
    }, [searchTerm]);

    // ── Manual form submit (keyboard accessibility) ───────────────────────────
    const handleSearch = useCallback((e) => {
        e.preventDefault();
        clearTimeout(debounceRef.current);
        if (!searchTerm.trim()) return;
        setLoading(true);
        setError(null);
        setHasSearched(true);
        searchBank(searchTerm)
            .then(banks => {
                setResults(banks);
                requestAnimationFrame(() => setResultsVisible(true));
            })
            .catch(() => setError('Failed to fetch banks. Please try again.'))
            .finally(() => setLoading(false));
    }, [searchTerm]);

    const handleBankClick = (bank) => {
        localStorage.setItem('recent_bank', JSON.stringify(bank));
        setRecentBank(bank);
        onBankSelect(bank);
    };

    return (
        <div className="w-full max-w-2xl mx-auto group/container">
            {/* Main Search Box */}
            <div
                className="w-full p-8 bg-[#1e2336] rounded-[24px] text-slate-100 text-left shadow-[0_8px_30px_rgb(0,0,0,0.4)] border border-slate-700/50 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(59,130,246,0.15)] mb-6"
            >
                {/* ── Header ── */}
                <h2 className="text-3xl font-bold tracking-tight mb-4 text-white">
                    Find Your Bank
                </h2>
                <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                    Enter a name (e.g. &ldquo;Chase&rdquo;) and click Search.
                </p>

                {/* ── Search Form ── */}
                <form onSubmit={handleSearch} className="flex gap-4">
                    <div className="relative flex-1">
                        {/* Left icon omitted to match mockup, but kept in code for utility if needed or can be removed completely. Mockup doesn't show an icon in the input. Let's remove it to match exactly. */}

                        <input
                            id="bank-search-input"
                            ref={inputRef}
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Enter bank name..."
                            className="
                                peer w-full px-5 py-4
                                border border-slate-700/60 rounded-xl
                                bg-[#0f172a] text-white placeholder-slate-500
                                text-base font-medium
                                transition-all duration-300
                                focus:outline-none focus:bg-[#0b1120]
                                focus:border-blue-500
                                focus:shadow-[0_0_0_4px_rgba(59,130,246,0.15)]
                                hover:border-slate-600
                            "
                            autoComplete="off"
                            aria-label="Bank name search"
                        />

                        {/* Right: spinner */}
                        {loading && (
                            <div
                                className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"
                                aria-hidden="true"
                            />
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="
                            px-8 py-4 rounded-xl text-base font-bold tracking-wide
                            bg-[#1d64ff] text-white
                            shadow-md shadow-blue-500/20
                            hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/40 hover:-translate-y-0.5
                            active:bg-blue-700 active:translate-y-0
                            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0
                            transition-all duration-300 ease-out
                            focus:outline-none focus:ring-4 focus:ring-blue-500/20
                        "
                    >
                        Search
                    </button>
                </form>

                {/* ── Error ── */}
                {error && (
                    <div
                        className="bg-red-900/40 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl mt-6 text-sm"
                        role="alert"
                    >
                        <span className="font-semibold">Error — </span>{error}
                    </div>
                )}

                {/* ── Results ── */}
                {results.length > 0 && (
                    <ul
                        className={`
                            divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden mt-6 bg-[#0B1120]
                            transition-all duration-300 ease-out shadow-2xl
                            ${resultsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
                        `}
                        role="listbox"
                        aria-label="Search results"
                    >
                        {results.map((bank) => (
                            <li
                                key={bank.CERT}
                                role="option"
                                aria-selected="false"
                                onClick={() => handleBankClick(bank)}
                                className="
                                    px-5 py-4 cursor-pointer
                                    flex justify-between items-center gap-4
                                    bg-transparent hover:bg-blue-900/40
                                    transition-colors duration-150
                                    group
                                "
                            >
                                <div className="min-w-0">
                                    <p className="font-semibold text-[15px] text-white truncate">
                                        <HighlightMatch text={bank.NAME} query={searchTerm} />
                                    </p>
                                    <p className="text-sm text-slate-400 mt-1 truncate">
                                        {bank.CITY}, {bank.STNAME}
                                    </p>
                                </div>
                                <span className="text-xs font-mono text-slate-500 bg-slate-800/50 border border-slate-700/50 rounded-md px-2 py-1 whitespace-nowrap shrink-0 group-hover:border-blue-500/30 group-hover:text-blue-300 group-hover:bg-blue-900/50 transition-colors duration-150 shadow-sm">
                                    #{bank.CERT}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}

                {/* ── Designed Empty State ── */}
                {results.length === 0 && !loading && hasSearched && !error && (
                    <div className="mt-6">
                        <EmptyState />
                    </div>
                )}
            </div>

            {/* Recent Searches */}
            {recentBank && (
                <div className="flex items-center justify-center gap-3 animate-fadeSlideIn">
                    <span className="text-xs font-bold tracking-widest text-[#7285a5] uppercase">Recent:</span>
                    <button
                        onClick={() => handleBankClick(recentBank)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#1e2336]/60 hover:bg-[#1e2336] border border-slate-700/50 hover:border-blue-500/50 rounded-full text-sm font-medium text-slate-300 hover:text-white transition-all duration-200 shadow-sm"
                    >
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="truncate max-w-[250px]">{recentBank.NAME}</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default BankSearch;
