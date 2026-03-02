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
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <svg
                    aria-hidden="true"
                    className="w-6 h-6 text-slate-400"
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
            <p className="text-sm font-semibold text-slate-700">No banks found</p>
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

    return (
        <div
            className="w-full max-w-md mx-auto p-6 bg-white rounded-2xl text-slate-900 text-left"
            style={{
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07), 0 12px 40px -8px rgba(0,0,0,0.14)',
                border: '1px solid rgba(0,0,0,0.06)',
            }}
        >
            {/* ── Header ── */}
            <h2 className="text-2xl font-bold tracking-tight mb-1 text-slate-900">
                Find Your Bank
            </h2>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                Start typing a bank name (e.g.&nbsp;&ldquo;Chase&rdquo;) — results appear automatically.
                <span className="ml-1 inline-flex items-center gap-0.5 text-slate-400">
                    Press{' '}
                    <kbd className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded px-1 py-0.5 mx-0.5 pointer-events-none select-none">
                        /
                    </kbd>
                    to jump here.
                </span>
            </p>

            {/* ── Search Form ── */}
            <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                <div className="relative flex-1">
                    {/* Left icon */}
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none transition-colors duration-200 peer-focus:text-blue-500" />

                    <input
                        id="bank-search-input"
                        ref={inputRef}
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Enter bank name..."
                        className="
                            peer w-full pl-9 pr-9 py-2.5
                            border border-slate-200 rounded-xl
                            bg-slate-50 text-slate-900 placeholder-slate-400
                            text-sm
                            transition-all duration-200
                            focus:outline-none focus:bg-white
                            focus:border-blue-400
                            focus:ring-4 focus:ring-blue-500/10
                            hover:border-slate-300
                        "
                        style={{ color: '#0f172a' }}
                        autoComplete="off"
                        aria-label="Bank name search"
                    />

                    {/* Right: spinner or / hint */}
                    {loading ? (
                        <div
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"
                            aria-hidden="true"
                        />
                    ) : (
                        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 bg-slate-100 border border-slate-200 rounded px-1 py-0.5 pointer-events-none select-none opacity-80">
                            esc
                        </kbd>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="
                        px-5 py-2.5 rounded-xl text-sm font-semibold
                        bg-blue-600 text-white
                        shadow-sm shadow-blue-200
                        hover:bg-blue-500 active:bg-blue-700
                        disabled:opacity-40 disabled:cursor-not-allowed
                        transition-all duration-150
                        focus:outline-none focus:ring-4 focus:ring-blue-500/20
                    "
                >
                    Search
                </button>
            </form>

            {/* ── Error ── */}
            {error && (
                <div
                    className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm"
                    role="alert"
                >
                    <span className="font-semibold">Error — </span>{error}
                </div>
            )}

            {/* ── Results ── */}
            {results.length > 0 && (
                <ul
                    className={`
                        divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden mt-2
                        transition-all duration-300 ease-out
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
                            onClick={() => onBankSelect(bank)}
                            className="
                                px-4 py-3 cursor-pointer
                                flex justify-between items-center gap-3
                                bg-white hover:bg-blue-50
                                transition-colors duration-100
                                group
                            "
                        >
                            <div className="min-w-0">
                                <p className="font-semibold text-sm text-slate-800 truncate">
                                    <HighlightMatch text={bank.NAME} query={searchTerm} />
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5 truncate">
                                    {bank.CITY}, {bank.STNAME}
                                </p>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 whitespace-nowrap shrink-0 group-hover:border-blue-200 group-hover:text-blue-600 transition-colors duration-100">
                                #{bank.CERT}
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            {/* ── Designed Empty State ── */}
            {results.length === 0 && !loading && hasSearched && !error && (
                <EmptyState />
            )}
        </div>
    );
};

export default BankSearch;
