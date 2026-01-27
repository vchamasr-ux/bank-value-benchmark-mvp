import React, { useState } from 'react';
import { searchBank } from '../services/fdicService';

const BankSearch = ({ onBankSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchTerm.trim()) return;

        setLoading(true);
        setError(null);
        setHasSearched(true);
        try {
            const banks = await searchBank(searchTerm);
            setResults(banks);
        } catch (err) {
            setError('Failed to fetch banks. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        setSearchTerm(e.target.value);
        if (hasSearched) setHasSearched(false);
    };

    return (
        <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Find Your Bank</h2>
            <p className="text-xs text-gray-500 mb-4">Enter a name (e.g. "Chase") and click Search.</p>
            <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={handleInputChange}
                    placeholder="Enter bank name..."
                    className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? 'Searching...' : 'Search'}
                </button>
            </form>

            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
                    <p className="font-bold">Error</p>
                    <p>{error}</p>
                </div>
            )}

            {results.length > 0 && (
                <ul className="divide-y divide-gray-200 border border-gray-200 rounded">
                    {results.map((bank) => (
                        <li
                            key={bank.CERT}
                            onClick={() => onBankSelect(bank)}
                            className="p-3 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors"
                        >
                            <div>
                                <p className="font-semibold text-gray-700">{bank.NAME}</p>
                                <p className="text-sm text-gray-500">{bank.CITY}, {bank.STNAME}</p>
                            </div>
                            <span className="text-xs text-gray-400">CERT: {bank.CERT}</span>
                        </li>
                    ))}
                </ul>
            )}

            {results.length === 0 && !loading && hasSearched && !error && (
                <p className="text-gray-500 text-center text-sm mt-2">No active banks found.</p>
            )}
        </div>
    );
};

export default BankSearch;
