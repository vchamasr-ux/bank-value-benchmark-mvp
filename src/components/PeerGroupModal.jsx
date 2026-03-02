import React from 'react';
import USMap from './USMap';

const PeerGroupModal = ({ isOpen, onClose, title, banks, subjectState, onBankSelect }) => {
    if (!isOpen) return null;

    // Calculate peer state counts for the map
    const peerStateCounts = banks ? banks.reduce((acc, peer) => {
        const st = peer.stalp;
        acc[st] = (acc[st] || 0) + 1;
        return acc;
    }, {}) : {};

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal — max-w-5xl wide, capped at 85vh, split-panel body */}
            <div className="relative bg-[#0B1120]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.4)] w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-5 border-b border-white/10 flex justify-between items-center bg-slate-900/50 shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-white">{title}</h3>
                        <p className="text-sm text-slate-400 mt-0.5">
                            Comparison Sample Group · {banks?.length || 0} banks
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

                {/* ── Two-Column Body ── */}
                <div className="flex flex-1 overflow-hidden min-h-0">

                    {/* Left: Map panel — fixed width, vertically centered */}
                    <div className="w-72 shrink-0 border-r border-white/10 flex flex-col items-center justify-center gap-3 p-5 bg-slate-900/30">
                        <USMap subjectState={subjectState} peerStates={peerStateCounts} />
                        <p className="text-xs text-slate-500 italic text-center leading-relaxed">
                            Click any bank →<br />to compare side-by-side
                        </p>
                    </div>

                    {/* Right: Bank list — independently scrollable, no horizontal overflow */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
                        <table className="w-full">
                            <thead className="bg-slate-800/90 sticky top-0 z-10">
                                <tr>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Bank</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">City, State</th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase tracking-wider w-24">Assets</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {banks && banks.length > 0 ? (
                                    banks.map((bank, index) => (
                                        <tr
                                            key={`${bank.name}-${index}`}
                                            className="hover:bg-blue-900/40 transition-colors cursor-pointer group"
                                            onClick={() => onBankSelect && onBankSelect(bank)}
                                            title="Click to compare side-by-side"
                                        >
                                            <td className="px-4 py-3 text-sm font-medium text-slate-200 group-hover:text-blue-400 transition-colors max-w-[200px] truncate">
                                                {bank.name}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
                                                {bank.city}, {bank.state}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-200 text-right font-mono whitespace-nowrap w-24">
                                                ${(bank.asset / 1000000).toFixed(1)}B
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="3" className="px-4 py-8 text-center text-sm text-slate-500 italic">
                                            No peer bank details available.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-slate-900/50 flex justify-end shrink-0">
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
