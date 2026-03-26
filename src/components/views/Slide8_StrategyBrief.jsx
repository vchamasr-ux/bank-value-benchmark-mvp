import React, { useState, useEffect, useCallback } from 'react';

// Reusing the same KPI specs to ensure consistency with MoversView
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

// Deterministic Strategy Logic based on the primary driving KPI
const generateStrategy = (topDriver, focusBankName) => {
    if (!topDriver) return "Maintain current operational focus and monitor market conditions.";

    const { key } = topDriver.spec;
    const isPositive = topDriver.signedZ > 0; // Did they outperform or underperform expectations on this metric?

    // Short bank name for the text
    const self = focusBankName ? focusBankName.split(' ')[0] : 'We';

    const strategies = {
        "asset_growth_3y": isPositive
            ? `Competitor is rapidly capturing market share. ${self} must actively defend lending footprint.`
            : `Competitor is shedding assets. Opportunities exist for ${self} to target their displaced clients.`,
        "loan_growth_3y": isPositive
            ? `Competitor demonstrating strong loan originations. ${self} should review local pricing competitiveness.`
            : `Competitor facing origination headwinds. ${self} is well-positioned to aggressively capture loan demand.`,
        "deposit_growth_3y": isPositive
            ? `Competitor is successfully hoarding core deposits. ${self} must elevate treasury management offerings.`
            : `Competitor vulnerable to deposit flight. ${self} should target their client base with acquisition campaigns.`,
        "eff_ratio": isPositive
            ? `Competitor exhibits superior cost-control. ${self} should benchmark overhead and automation levels.`
            : `Competitor struggling with operating leverage. ${self} has a clear efficiency advantage to exploit.`,
        "nim": isPositive
            ? `Competitor defending margins exceptionally well. ${self} should analyze their pricing and funding mix.`
            : `Competitor suffering margin compression. ${self} can leverage stronger relative margins to price aggressively.`,
        "cost_of_funds": isPositive
            ? `Competitor maintains an advantageous low-cost core deposit base. ${self} must fiercely defend NIB accounts.`
            : `Competitor facing severe funding cost pressures. ${self} should capitalize on relative funding stability.`,
        "non_int_income_pct": isPositive
            ? `Competitor diversifying revenue effectively. ${self} must expand wealth management or treasury offerings.`
            : `Competitor over-reliant on interest income. ${self} should emphasize holistic relationship banking to win clients.`,
        "loan_yield": isPositive
            ? `Competitor extracting premium pricing on assets. ${self} should review portfolio pricing optimization capabilities.`
            : `Competitor sacrificing yield for volume. ${self} should focus on high-quality borrowers willing to pay a premium.`,
        "roe": isPositive
            ? `Competitor generating superior shareholder returns. ${self} must identify and optimize underperforming allocations.`
            : `Competitor struggling with baseline equity returns. ${self} should highlight stability to attract their key personnel.`,
        "roa": isPositive
            ? `Competitor utilizing assets highly efficiently. ${self} should explore workflow automation to match bottom-line profitability.`
            : `Competitor struggling to translate assets into earnings. ${self} should capitalize on their operational distractions.`,
        "npl_ratio": isPositive
            ? `Competitor maintaining pristine credit quality. ${self} should ensure underwriting standards remain strictly disciplined.`
            : `Competitor distracted by distressed asset work-outs. ${self} is uniquely positioned to capture top-tier borrower flight.`
    };

    return strategies[key] || `Monitor competitor's strategic maneuvers and evaluate long-term viability relative to ${self}.`;
};

const Slide8_StrategyBrief = ({ dataProvider, segmentKey, segmentLabel, priorQuarter, currentQuarter, focusBankCert, focusBankName, isPresentationMode = true }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [movers, setMovers] = useState([]);

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

            // 2. Compute Top Movers (reusing MoversView logic for deterministic scoring)
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
                    // signedZ measures directional outperformance: positive means better than expected, negative means worse.
                    const signedZ = spec.better === "higher" ? z : -z;
                    return { spec, delta, z, absZ: Math.abs(z), signedZ };
                }).sort((a, b) => b.absZ - a.absZ); // Sort by magnitude of surprise

                // Isolate the single biggest driver of their surprise score
                const primaryDriver = drivers[0];

                return {
                    cert: bank.cert,
                    bankName: bank.name,
                    surprise: drivers.reduce((acc, d) => acc + d.absZ, 0),
                    primaryDriver,
                    strategyInsight: generateStrategy(primaryDriver, focusBankName)
                };
            });

            // Sort by absolute surprise score (the most "mobile" banks in the segment)
            const topMovers = rows.sort((a, b) => b.surprise - a.surprise).slice(0, 5);

            setMovers(topMovers);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [dataProvider, segmentKey, currentQuarter, priorQuarter, focusBankCert]);

    useEffect(() => {
        fetchAndAnalyze();
    }, [segmentKey, currentQuarter, fetchAndAnalyze]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-6">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
                <div className="text-center">
                    <h3 className="text-xl font-bold text-blue-900">Generating Strategy Briefs</h3>
                    <p className="text-slate-500 text-sm mt-1 italic">Analyzing market anomalies for top 5 peers...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center max-w-xl shadow-sm">
                    <div className="text-3xl mb-4">⚠️</div>
                    <h3 className="text-red-900 font-bold text-lg">Strategy Generation Failed</h3>
                    <p className="text-red-700 mt-2">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full px-6 pt-2 pb-4 overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both"
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '14px' }}>

            {movers.slice(0, 4).map((mover, idx) => {
                const isPositiveDriver = mover.primaryDriver.signedZ > 0;
                return (
                    <div key={mover.cert}
                        className="rounded-xl p-5 flex flex-col gap-3 relative overflow-hidden"
                        style={{
                            background: 'linear-gradient(135deg, #0f1f3d 0%, #1a2e54 60%, #1e3a6e 100%)',
                            border: '1px solid rgba(99,140,255,0.2)',
                            boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)'
                        }}>
                        {/* Subtle glow top-left */}
                        <div className="absolute top-0 left-0 w-32 h-20 opacity-20 pointer-events-none"
                            style={{ background: 'radial-gradient(ellipse at top left, #4f8fff, transparent)' }} />

                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-3 relative">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg font-black text-base flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'rgba(79,143,255,0.2)', color: '#93c5fd', border: '1px solid rgba(79,143,255,0.35)' }}>
                                    {idx + 1}
                                </div>
                                <h3 className="text-[15px] font-bold leading-tight text-white" title={mover.bankName}>{mover.bankName}</h3>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <div className="text-[8px] font-bold uppercase tracking-widest leading-none mb-1" style={{ color: 'rgba(148,163,184,0.7)' }}>Primary Driver</div>
                                <div className={`font-bold text-xs ${isPositiveDriver ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {mover.primaryDriver.spec.label} {mover.primaryDriver.z > 0 ? '+' : ''}{mover.primaryDriver.z.toFixed(2)}σ
                                </div>
                            </div>
                        </div>

                        {/* Strategy Quote */}
                        <div className="flex-1 flex items-center px-4 py-3 rounded-r-lg relative"
                            style={{
                                borderLeft: `3px solid ${isPositiveDriver ? '#34d399' : '#f87171'}`,
                                background: 'rgba(0,0,0,0.25)',
                                backdropFilter: 'blur(4px)'
                            }}>
                            <p className="font-medium italic text-[14px] leading-relaxed" style={{ color: 'rgba(226,232,240,0.9)' }}>
                                "{mover.strategyInsight}"
                            </p>
                        </div>
                    </div>
                );
            })}

        </div>
    );
};

export default Slide8_StrategyBrief;
