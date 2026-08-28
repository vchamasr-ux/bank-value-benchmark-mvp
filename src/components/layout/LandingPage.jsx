import React from 'react';
import BankSearch from '../search/BankSearch';

// #7 — Centralised social proof stats. Update here when FDIC coverage or model changes.
const STATS = [
    { value: '4,700+', label: 'FDIC Banks Covered' },
    { value: '20 Qtrs', label: 'of Call Report History' },
    { value: 'Gemini 2.5', label: 'Flash AI Model' },
];

const LandingPage = ({ onBankSelect }) => {
    return (
        <div className="w-full">
            {/* Hero Section */}
            <section className="relative bg-slate-900 text-white overflow-hidden py-24 sm:py-32">
                <div className="absolute inset-0">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/40 via-slate-900 to-slate-900"></div>
                </div>

                <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
                    <h1 className="text-5xl sm:text-7xl font-black tracking-tight mb-6">
                        Strategic Clarity in <span className="text-blue-400">Seconds.</span>
                    </h1>
                    <p className="mt-4 text-xl sm:text-2xl text-slate-300 max-w-3xl mx-auto mb-12">
                        Instant FDIC benchmarking and AI-driven competitive radar for U.S. banks. Stop wrestling with Call Reports.
                    </p>

                    <div className="max-w-2xl mx-auto relative z-10">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl blur opacity-30 animate-pulse"></div>
                        <div className="relative">
                            <BankSearch onBankSelect={onBankSelect} />
                        </div>
                    </div>

                    <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 text-sm font-medium text-slate-400">
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Live Data from FDIC
                        </div>
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            AI Powered by Gemini
                        </div>
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            Secured by LinkedIn
                        </div>
                    </div>

                    {/* Social proof stats bar */}
                    <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-px border border-white/10 rounded-2xl overflow-hidden bg-white/5 backdrop-blur-sm divide-y sm:divide-y-0 sm:divide-x divide-white/10 max-w-2xl mx-auto">
                        {STATS.map(({ value, label }) => (
                            <div key={label} className="flex-1 px-8 py-4 text-center">
                                <div className="text-2xl font-black text-white tracking-tight">{value}</div>
                                <div className="text-xs text-slate-400 font-medium mt-0.5">{label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Value Proposition Section */}
            <section className="py-24 bg-slate-900 relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_var(--tw-gradient-stops))] from-blue-900/10 via-slate-900 to-slate-900"></div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
                        {/* Prop 1 */}
                        <div className="group">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800/50 border border-slate-700 text-blue-400 mb-6 group-hover:scale-110 group-hover:bg-blue-600 group-hover:border-blue-500 group-hover:text-white transition-all duration-300 shadow-sm backdrop-blur-sm">
                                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3 tracking-tight">Dynamic Peer Groups</h3>
                            <p className="text-slate-400 leading-relaxed">
                                We automatically identify your 20 closest competitors based on asset size and geographic footprint.
                            </p>
                        </div>
                        {/* Prop 2 */}
                        <div className="group">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800/50 border border-slate-700 text-blue-400 mb-6 group-hover:scale-110 group-hover:bg-blue-600 group-hover:border-blue-500 group-hover:text-white transition-all duration-300 shadow-sm backdrop-blur-sm">
                                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3 tracking-tight">Real-Time Data Pipeline</h3>
                            <p className="text-slate-400 leading-relaxed">
                                No outdated PDFs. We ingest 16 quarters of raw Call Report data the moment the FDIC publishes it.
                            </p>
                        </div>
                        {/* Prop 3 */}
                        <div className="group">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800/50 border border-slate-700 text-blue-400 mb-6 group-hover:scale-110 group-hover:bg-blue-600 group-hover:border-blue-500 group-hover:text-white transition-all duration-300 shadow-sm backdrop-blur-sm">
                                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3 tracking-tight">AI Strategic Briefs</h3>
                            <p className="text-slate-400 leading-relaxed">
                                Click once to generate a board-ready competitive analysis using Gemini 2.5 Flash.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Give to Get Teaser */}
            <section className="bg-slate-950 py-20 border-t border-white/5 relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -ml-[40rem] w-[80rem] h-[40rem] opacity-20 pointer-events-none">
                     <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/20 to-transparent blur-3xl rounded-full"></div>
                </div>
                <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
                    <div className="inline-block px-4 py-1.5 rounded-full bg-indigo-500/10 text-indigo-400 font-bold text-xs uppercase tracking-widest mb-6 border border-indigo-500/20 backdrop-blur-sm">
                        Operational Benchmarks
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">Go Beyond Public Data</h2>
                    <p className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto">
                        Unlock elite operational metrics like Digital Adoption and Cost to Acquire by contributing your own anonymous data to our "Give-to-Get" pool.
                    </p>
                </div>
            </section>
        </div>
    );
};

export default LandingPage;
