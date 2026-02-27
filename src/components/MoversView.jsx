import React, { useState, useEffect } from 'react';

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

const MoversView = ({ dataProvider, segmentKey, segmentLabel, priorQuarter, currentQuarter, perspectiveBankName, focusBankCert, onDrillDown, onShowBrief }) => {
    const [activeTab, setActiveTab] = useState('threats'); // 'threats' | 'playbooks'
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [moversData, setMoversData] = useState({ threats: [], playbooks: [], tape: "" });

    useEffect(() => {
        fetchAndAnalyze();
    }, [segmentKey, currentQuarter]);

    const fetchAndAnalyze = async () => {
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
    };

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
            <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center max-w-xl mx-auto my-20">
                <div className="text-3xl mb-4">⚠️</div>
                <h3 className="text-red-900 font-bold text-lg">Radar Interrupted</h3>
                <p className="text-red-700 mt-2">{error}</p>
                <button onClick={fetchAndAnalyze} className="mt-6 px-4 py-2 bg-red-600 text-white rounded-lg font-bold">Retry Scan</button>
            </div>
        );
    }

    const currentList = activeTab === 'threats' ? moversData.threats : moversData.playbooks;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Header / Stats */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-[10px] font-black uppercase tracking-wider mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                        RADAR ACTIVE: {segmentLabel}
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 leading-tight">Competitive Radar</h2>
                    <p className="text-slate-500 text-sm">Identifying outliers in {currentQuarter} vs {priorQuarter} </p>
                </div>

                <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('threats')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'threats' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                        Market Threats ({moversData.threats.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('playbooks')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'playbooks' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                        Growth Playbooks ({moversData.playbooks.length})
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    {currentList.length === 0 ? (
                        <div className="bg-white p-20 rounded-2xl border border-dashed border-slate-300 text-center text-slate-400">
                            No {activeTab} detected in this segment.
                        </div>
                    ) : (
                        currentList.map((m, idx) => (
                            <div key={m.cert} className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all">
                                <div className="p-5 flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xs font-black ${activeTab === 'threats' ? 'text-red-500' : 'text-green-500'} bg-slate-100 w-6 h-6 flex items-center justify-center rounded-full`}>{idx + 1}</span>
                                            <h4
                                                className="text-lg font-bold text-slate-900 cursor-pointer hover:text-blue-600 flex items-center gap-1"
                                                onClick={() => handleDrillDown(m.cert)}
                                            >
                                                {m.bankName}
                                            </h4>
                                        </div>
                                        <div className="mt-4 flex flex-wrap gap-4">
                                            {m.topDrivers.map((d, dIdx) => (
                                                <div key={dIdx} className="flex flex-col">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase">{d.spec.label}</span>
                                                    <span className={`text-sm font-bold ${d.signedZ > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {d.z > 0 ? '+' : ''}{d.z.toFixed(2)}σ <span className="text-[10px] text-slate-400 font-medium">({d.delta > 0 ? '+' : ''}{(d.delta * 100).toFixed(2)}%)</span>
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] text-slate-400 font-black uppercase mb-1">Surprise Score</div>
                                        <div className={`text-2xl font-black ${activeTab === 'threats' ? 'text-red-600' : 'text-green-600'}`}>
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
                    <div className="bg-blue-900 rounded-2xl p-6 text-white shadow-xl">
                        <h3 className="font-black text-lg mb-2">AI Intelligence</h3>
                        <p className="text-blue-100 text-sm mb-6 leading-relaxed">Synthesize these market signals into a strategic brief for {perspectiveBankName}.</p>

                        <button
                            className="w-full bg-white text-blue-900 py-3 rounded-xl font-bold shadow-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                            onClick={onShowBrief}
                        >
                            <span>🪄</span> Generate Strategic Brief
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-4 text-sm">How to read the Radar</h3>
                        <div className="space-y-4">
                            <div className="flex gap-3">
                                <span className="bg-slate-100 text-xs p-2 rounded-lg">σ</span>
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    <strong className="text-slate-700">Sigma Scopes:</strong> We measure performance volatility relative to the peer group. High sigma (&gt; 2) indicates a "Breakout" or "Breakdown".
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <span className="bg-slate-100 text-xs p-2 rounded-lg">⚡</span>
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    <strong className="text-slate-700">Surprise:</strong> Cumulative absolute volatility across {KPI_SPECS.length} KPIs. Higher surprise means a bank has fundamentally shifted its profile.
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
