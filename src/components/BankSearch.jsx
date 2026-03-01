import React, { useState, useEffect, useRef } from 'react';
import { searchBank } from '../services/fdicService';

// #3 — Debounced live search (300ms) so results appear as the user types
const DEBOUNCE_MS = 300;

const BankSearch = ({ onBankSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);
    const debounceRef = useRef(null);

    // Debounced search fires automatically as the user types
    useEffect(() => {
        if (!searchTerm.trim()) {
            setResults([]);
            setHasSearched(false);
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
            } catch {
                setError('Failed to fetch banks. Please try again.');
            } finally {
                setLoading(false);
            }
        }, DEBOUNCE_MS);

        return () => clearTimeout(debounceRef.current);
    }, [searchTerm]);

    // Keep form submit working for keyboard accessibility
    const handleSearch = (e) => {
        e.preventDefault();
        clearTimeout(debounceRef.current);
        if (!searchTerm.trim()) return;
        setLoading(true);
        setError(null);
        setHasSearched(true);
        searchBank(searchTerm)
            .then(banks => setResults(banks))
            .catch(() => setError('Failed to fetch banks. Please try again.'))
            .finally(() => setLoading(false));
    };

    return (
        <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md text-slate-900 text-left">
            <h2 className="text-xl font-bold mb-4 text-slate-800">Find Your Bank</h2>
            <p className="text-xs text-slate-500 mb-4">Start typing a bank name (e.g. "Chase") — results appear automatically.</p>
            <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                <div className="relative flex-1">
                    <input
                        id="bank-search-input"
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Enter bank name..."
                        className="w-full p-2 pr-8 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white placeholder-slate-400"
                        style={{ color: '#0f172a' }}
                        autoComplete="off"
                    />
                    {loading ? (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200 rounded px-1 py-0.5 pointer-events-none select-none">/</kbd>
                    )}
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    Search
                </button>
            </form>

            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
                    <p className="font-bold">Error</p>
                    <p>{error}</p>
                </div>
            )}

            {results.length > 0 && (
                <ul className="divide-y divide-slate-200 border border-slate-200 rounded mt-2">
                    {results.map((bank) => (
                        <li
                            key={bank.CERT}
                            onClick={() => onBankSelect(bank)}
                            className="p-3 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors bg-white text-slate-900"
                        >
                            <div>
                                <p className="font-semibold text-slate-800">{bank.NAME}</p>
                                <p className="text-sm text-slate-500">{bank.CITY}, {bank.STNAME}</p>
                            </div>
                            <span className="text-xs text-slate-400">CERT: {bank.CERT}</span>
                        </li>
                    ))}
                </ul>
            )}

            {results.length === 0 && !loading && hasSearched && !error && (
                <p className="text-slate-500 text-center text-sm mt-2">No active banks found.</p>
            )}
        </div>
    );
};

export default BankSearch;
