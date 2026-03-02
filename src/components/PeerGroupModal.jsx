import React from 'react';
import USMap from './USMap';

const PeerGroupModal = ({ isOpen, onClose, title, banks, subjectState, onBankSelect }) => {
    if (!isOpen) return null;

    // Calculate peer state counts for the map
    const peerStateCounts = banks ? banks.reduce((acc, peer) => {
        const st = peer.stalp; // Use 2-letter code (STALP) instead of full name (state)
        acc[st] = (acc[st] || 0) + 1;
        return acc;
    }, {}) : {};

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative bg-[#0B1120]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.4)] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900/50">
                    <div>
                        <h3 className="text-xl font-bold text-white">{title}</h3>
                        <p className="text-sm text-slate-400 mt-1">
                            Comparison Sample Group
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto p-6 flex-1">

                    {/* Geographic Distribution Map (Appendix) */}
                    <div className="mb-8 flex flex-col items-center border-b border-white/10 pb-8">
                        <USMap
                            subjectState={subjectState}
                            peerStates={peerStateCounts}
                        />
                        <p className="text-xs text-slate-500 mt-2 italic">
                            Geographic distribution of peer group banks.
                        </p>
                    </div>

                    <div className="overflow-hidden border border-white/10 rounded-lg">
                        <table className="min-w-full divide-y divide-white/10">
                            <thead className="bg-slate-800/80">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Bank Name</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Location</th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Total Assets</th>
                                </tr>
                            </thead>
                            <tbody className="bg-transparent divide-y divide-white/5">
                                {banks && banks.length > 0 ? (
                                    banks.map((bank, index) => (
                                        <tr
                                            key={`${bank.name}-${index}`}
                                            className="hover:bg-blue-900/40 transition-colors cursor-pointer group"
                                            onClick={() => onBankSelect && onBankSelect(bank)}
                                            title="Click to compare side-by-side"
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-200 group-hover:text-blue-400 transition-colors">
                                                {bank.name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                                                {bank.city}, {bank.state}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-200 text-right font-mono">
                                                ${(bank.asset / 1000000).toFixed(1)}B
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="3" className="px-6 py-8 text-center text-sm text-slate-500 italic">
                                            No peer bank details available.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-slate-900/50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm font-medium text-slate-200 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PeerGroupModal;
