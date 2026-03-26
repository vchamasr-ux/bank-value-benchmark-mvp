import React, { useState, useEffect, useCallback } from 'react';

// --- KPI config (Same as used in analysis) ---
const KPI_SPECS = [
    { key: "asset_growth_3y", label: "3Y Asset Growth", better: "higher", type: "rate", metric_class: "derived" },
    { key: "loan_growth_3y", label: "3Y Loan Growth", better: "higher", type: "rate", metric_class: "derived" },
    { key: "deposit_growth_3y", label: "3Y Deposit Growth", better: "higher", type: "rate", metric_class: "derived" },
    { key: "eff_ratio", label: "Efficiency Ratio", better: "lower", type: "rate", metric_class: "core" },
    { key: "nim", label: "NIM", better: "higher", type: "rate", metric_class: "core" },
    { key: "cost_of_funds", label: "Cost of Funds", better: "lower", type: "rate", metric_class: "core" },
    { key: "non_int_income_pct", label: "Non-Int Income %", better: "higher", type: "rate", metric_class: "core" },
    { key: "loan_yield", label: "Yield on Loans", better: "higher", type: "rate", metric_class: "core" },
    { key: "roe", label: "ROE", better: "higher", type: "rate", metric_class: "core" },
    { key: "roa", label: "ROA", better: "higher", type: "rate", metric_class: "core" },
    { key: "npl_ratio", label: "NPL Ratio", better: "lower", type: "rate", metric_class: "core" },
];

const MoversView = ({ dataProvider, segmentKey, segmentLabel, priorQuarter, currentQuarter, perspectiveBankName, focusBankCert, onDrillDown, onShowBrief, isPresentationMode, forcedTab }) => {
    const [activeTab, setActiveTab] = useState(forcedTab || 'threats'); // 'threats' | 'playbooks'
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [moversData, setMoversData] = useState({ threats: [], playbooks: [], tape: "" });

    const fetchAndAnalyze = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // 1. Fetch
            const peerBanks = await dataProvider.listPeerBanks({ segmentKey, quarter: currentQuarter, focusCert: focusBankCert });
            const quarters = [priorQuarter, currentQuarter];
            const kpiMap = {};

            for (const q of quarters) {
                const results = await Promise.allSettled(peerBanks.map(b => dataProvider.getBankKpis({ cert: b.cert, quarter: q })));
                results.forEach((r, i) => {
                    const cert = peerBanks[i].cert;
                    if (!kpiMap[cert]) kpiMap[cert] = {};
                    kpiMap[cert][q] = r.status === "fulfilled" ? r.value : null;
                });
            }

            // 2. Compute
            const completePeers = peerBanks.filter(b => quarters.every(q => kpiMap[b.cert][q] !== null));
            if (completePeers.length < 5) throw new Error("Insufficient peer historical data.");

            const distByMetric = {};
            const statsByMetric = {};
            for (const spec of KPI_SPECS) {
                const vals = completePeers.map(b => kpiMap[b.cert][currentQuarter][spec.key] - kpiMap[b.cert][priorQuarter][spec.key]);
                const sorted = [...vals].sort((a, b) => a - b);
                distByMetric[spec.key] = sorted;
                const p25 = sorted[Math.floor(sorted.length * 0.25)];
                const p75 = sorted[Math.floor(sorted.length * 0.75)];
                statsByMetric[spec.key] = { p50: sorted[Math.floor(sorted.length * 0.5)], iqr: Math.max(p75 - p25, 0.0001) };
            }

            const rows = completePeers.map(bank => {
                const drivers = KPI_SPECS.map(spec => {
                    const delta = kpiMap[bank.cert][currentQuarter][spec.key] - kpiMap[bank.cert][priorQuarter][spec.key];
                    const { p50, iqr } = statsByMetric[spec.key];
                    const z = (delta - p50) / iqr;
                    const signedZ = spec.better === "higher" ? z : -z;
                    return { spec, delta, z, absZ: Math.abs(z), signedZ };
                }).sort((a, b) => b.absZ - a.absZ);

                return {
                    cert: bank.cert,
                    bankName: bank.name,
                    surprise: drivers.reduce((acc, d) => acc + d.absZ, 0),
                    netDir: drivers.reduce((acc, d) => acc + d.signedZ, 0),
                    topDrivers: drivers.slice(0, 3)
                };
            });

            const threats = rows.filter(r => r.netDir < 0).sort((a, b) => b.surprise - a.surprise);
            const playbooks = rows.filter(r => r.netDir > 0).sort((a, b) => b.surprise - a.surprise);

            setMoversData({ threats, playbooks });
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [dataProvider, segmentKey, currentQuarter, priorQuarter, focusBankCert]);

    useEffect(() => {
        fetchAndAnalyze();
    }, [segmentKey, currentQuarter, fetchAndAnalyze]);

    useEffect(() => {
        if (forcedTab) setActiveTab(forcedTab);
    }, [forcedTab]);

    const handleDrillDown = (cert) => {
        if (onDrillDown) onDrillDown(cert);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-32 space-y-6">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
                <div className="text-center">
                    <h3 className="text-xl font-bold text-blue-900">Scanning Peer Radar</h3>
                    <p className="text-slate-500 text-sm mt-1 italic">Computing competitive anomalies for {segmentLabel}...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center max-w-xl mx-auto my-20">
                <div className="text-3xl mb-4">⚠️</div>
                <h3 className="text-red-900 font-bold text-lg">Radar Interrupted</h3>
                <p className="text-red-700 mt-2">{error}</p>
                <button onClick={fetchAndAnalyze} className="mt-6 px-4 py-2 bg-red-600 text-white rounded-lg font-bold">Retry Scan</button>
            </div>
        );
    }

    const currentList = activeTab === 'threats' ? moversData.threats : moversData.playbooks;
    const displayList = currentList;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-6">
            {/* Header / Stats - HIDDEN IN PRESENTATION MODE */}
            {!isPresentationMode && (
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 p-6 glass-panel-dark !mb-0 !shadow-none !hover:shadow-none">
                    <div>
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-md text-[10px] font-black uppercase tracking-wider mb-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                            RADAR ACTIVE: {segmentLabel}
                        </div>
                        <h2 className="text-2xl font-black text-white leading-tight">Competitive Radar</h2>
                        <p className="text-slate-400 text-sm">Identifying outliers in {currentQuarter} vs {priorQuarter} </p>
                    </div>

                    <div className="flex gap-2 bg-[#0B1120]/50 border border-white/5 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('threats')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'threats' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            Market Threats ({moversData.threats.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('playbooks')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'playbooks' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            Growth Playbooks ({moversData.playbooks.length})
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    {displayList.length === 0 ? (
                        <div className={`p-20 rounded-2xl border border-dashed text-center ${isPresentationMode ? 'bg-white border-slate-300 text-slate-400' : 'glass-panel-dark !mb-0 border-white/20 text-slate-500'}`}>
                            No {activeTab} detected in this segment.
                        </div>
                    ) : (
                        displayList.map((m, idx) => (
                            <div key={m.cert} className={`group transition-all cursor-[inherit] ${isPresentationMode ? 'bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md' : 'glass-panel-dark !mb-0 !p-0'}`}>
                                <div className={`flex justify-between items-start ${isPresentationMode ? 'p-5' : 'p-6'}`}>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xs font-black ${activeTab === 'threats' ? (isPresentationMode ? 'text-rose-700 bg-slate-100' : 'text-rose-400 bg-rose-500/10 border border-rose-500/20') : (isPresentationMode ? 'text-emerald-700 bg-slate-100' : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20')} w-6 h-6 flex items-center justify-center rounded-full`}>{idx + 1}</span>
                                            <h4
                                                className={`text-lg font-bold cursor-pointer flex items-center gap-1 ${isPresentationMode ? 'text-slate-900 hover:text-blue-600' : 'text-white hover:text-blue-400'}`}
                                                onClick={() => handleDrillDown(m.cert)}
                                            >
                                                {m.bankName}
                                            </h4>
                                        </div>
                                        <div className="mt-4 flex flex-wrap gap-4 mb-2">
                                            {m.topDrivers.map((d, dIdx) => (
                                                <div key={dIdx} className="flex flex-col">
                                                    <span className={`font-bold uppercase text-[10px] ${isPresentationMode ? 'text-slate-400' : 'text-slate-500'}`}>{d.spec.label}</span>
                                                    <span className={`font-bold ${d.signedZ > 0 ? (isPresentationMode ? 'text-emerald-800' : 'text-emerald-400') : (isPresentationMode ? 'text-rose-800' : 'text-rose-400')} text-sm`}>
                                                        {d.z > 0 ? '+' : ''}{d.z.toFixed(2)}σ <span className={`font-medium text-[10px] ${isPresentationMode ? 'text-slate-400' : 'text-slate-500'}`}>({d.delta > 0 ? '+' : ''}{(d.delta * 100).toFixed(2)}%)</span>
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        {m.topDrivers.length > 0 && (
                                            <div className={`mt-3 text-sm ${isPresentationMode ? 'text-slate-600' : 'text-slate-300'}`}>
                                                <strong>Interpretation:</strong> This bank is {Math.abs(m.topDrivers[0].z) > 2 ? 'significantly' : 'moderately'} {activeTab === 'threats' ? 'underperforming' : 'outperforming'} relative to peers, driven primarily by anomalous shifts in {m.topDrivers[0].spec.label}.
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-[10px] font-black uppercase mb-1 ${isPresentationMode ? 'text-slate-400' : 'text-slate-500'}`}>Surprise Score</div>
                                        <div className={`text-2xl font-black ${activeTab === 'threats' ? (isPresentationMode ? 'text-rose-800' : 'text-rose-400') : (isPresentationMode ? 'text-emerald-800' : 'text-emerald-400')}`}>
                                            {m.surprise.toFixed(1)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Always visible logic for the AI Brief box, keep original design if presentation */}
                    <div className="bg-blue-900 rounded-2xl text-white shadow-xl p-6 border border-blue-800">
                        <h3 className="font-black mb-2 text-lg">AI Intelligence</h3>
                        <p className="text-blue-100 text-sm mb-6 leading-relaxed">Synthesize these market signals into a strategic brief for {perspectiveBankName}.</p>
                        <button
                            className="w-full bg-white text-blue-900 py-3 rounded-xl font-bold shadow-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                            onClick={onShowBrief}
                        >
                            <span>🪄</span> Generate Strategic Brief
                        </button>
                    </div>

                    <div className={isPresentationMode ? 'bg-white rounded-2xl border border-slate-200 p-6 shadow-sm' : 'glass-panel-dark !mb-0 p-6'}>
                        <h3 className={`font-bold mb-4 text-sm ${isPresentationMode ? 'text-slate-900' : 'text-white'}`}>How to read the Radar</h3>
                        <div className="space-y-4">
                            <div className="flex gap-3">
                                <span className={`text-xs p-2 rounded-lg flex-shrink-0 flex items-center justify-center ${isPresentationMode ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-slate-300'}`}>σ</span>
                                <p className={`text-xs leading-relaxed ${isPresentationMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                    <strong className={isPresentationMode ? 'text-slate-700' : 'text-slate-200'}>Sigma Scopes:</strong> We measure performance volatility relative to the peer group. High sigma (&gt; 2) indicates a "Breakout" or "Breakdown".
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <span className={`text-xs p-2 rounded-lg flex-shrink-0 flex items-center justify-center ${isPresentationMode ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-slate-300'}`}>⚡</span>
                                <p className={`text-xs leading-relaxed ${isPresentationMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                    <strong className={isPresentationMode ? 'text-slate-700' : 'text-slate-200'}>Surprise:</strong> Cumulative absolute volatility across {KPI_SPECS.length} KPIs. Higher surprise means a bank has fundamentally shifted its profile.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MoversView;
