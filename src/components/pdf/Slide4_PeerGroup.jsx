import React from 'react';
import PresentationSlide from './PresentationSlide';

const Slide4_PeerGroup = ({ benchmarks, bankName }) => {
    if (!benchmarks || !benchmarks.peerBanks || benchmarks.peerBanks.length === 0) return null;

    // Sort banks alphabetically by state for cleaner reading
    const sortedBanks = [...benchmarks.peerBanks].sort((a, b) => {
        if (a.state === b.state) return a.name.localeCompare(b.name);
        return a.state.localeCompare(b.state);
    });

    return (
        <PresentationSlide title="Comparative Peer Group" bankName={bankName} id="pdf-slide-4">
            <div className="flex-1 flex flex-col gap-6 bg-white p-12 rounded-3xl border border-slate-200 shadow-sm" id="pdf-slide-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-8 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                            <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-3xl font-bold text-slate-900">Benchmark Cohort: {benchmarks.groupName}</h3>
                            <p className="text-lg text-slate-500">N={benchmarks.sampleSize} Institutions</p>
                        </div>
                    </div>
                </div>

                <div className="columns-3 gap-x-12 flex-1 overflow-hidden" style={{ columnFill: 'auto' }}>
                    {sortedBanks.map((bank, idx) => (
                        <div key={idx} className="flex justify-between items-end border-b border-slate-50 py-3 mb-2 break-inside-avoid">
                            <div className="flex flex-col truncate pr-4 max-w-[70%]">
                                <span className="font-bold text-slate-700 text-lg truncate" title={bank.name}>{bank.name}</span>
                                <span className="text-sm text-slate-400 font-medium">
                                    {bank.city}, {bank.state}
                                </span>
                            </div>
                            <span className="font-bold text-indigo-600 text-lg text-right shrink-0">
                                ${(parseFloat(bank.asset) / 1000000).toFixed(1)}B
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </PresentationSlide>
    );
};

export default Slide4_PeerGroup;
