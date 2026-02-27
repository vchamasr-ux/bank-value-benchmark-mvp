import React, { useState, useEffect } from 'react';
import { useAuth } from './auth/AuthContext';
import LoginModal from './auth/LoginModal';
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- KPI config: align keys to your existing KPI extraction ---
const KPI_SPECS = [
    { key: "asset_growth_3y", label: "3Y Asset Growth (CAGR)", better: "higher", type: "rate", metric_class: "derived" },
    { key: "loan_growth_3y", label: "3Y Loan Growth (CAGR)", better: "higher", type: "rate", metric_class: "derived" },
    { key: "deposit_growth_3y", label: "3Y Deposit Growth (CAGR)", better: "higher", type: "rate", metric_class: "derived" },
    { key: "eff_ratio", label: "Efficiency Ratio", better: "lower", type: "rate", metric_class: "core", base_key: "raw_revenue" },
    { key: "nim", label: "Net Interest Margin (NIM)", better: "higher", type: "rate", metric_class: "core", base_key: "raw_assets" },
    { key: "cost_of_funds", label: "Cost of Funds", better: "lower", type: "rate", metric_class: "core", base_key: "raw_deposits" },
    { key: "non_int_income_pct", label: "Non-Interest Income %", better: "higher", type: "rate", metric_class: "core", base_key: "raw_revenue" },
    { key: "loan_yield", label: "Yield on Loans", better: "higher", type: "rate", metric_class: "core", base_key: "raw_loans" },
    { key: "assets_per_employee", label: "Assets per Employee", better: "higher", type: "scalar", metric_class: "denominator-sensitive" },
    { key: "roe", label: "Return on Equity (ROE)", better: "higher", type: "rate", metric_class: "core", base_key: "raw_equity" },
    { key: "roa", label: "Return on Assets (ROA)", better: "higher", type: "rate", metric_class: "core", base_key: "raw_assets" },
    { key: "npl_ratio", label: "NPL Ratio", better: "lower", type: "rate", metric_class: "core", base_key: "raw_loans" },
];

const SNAPSHOT_KPIS = [
    { key: "nim", label: "NIM", better: "higher", fmt: (v) => `${(v * 100).toFixed(2)}%` },
    { key: "cost_of_funds", label: "Cost of Funds", better: "lower", fmt: (v) => `${(v * 100).toFixed(2)}%` },
    { key: "eff_ratio", label: "Efficiency Ratio", better: "lower", fmt: (v) => `${(v * 100).toFixed(1)}%` },
    { key: "npl_ratio", label: "NPL Ratio", better: "lower", fmt: (v) => `${(v * 100).toFixed(2)}%` },
    { key: "roa", label: "ROA", better: "higher", fmt: (v) => `${(v * 100).toFixed(2)}%` },
    { key: "non_int_income_pct", label: "Non-Int Income %", better: "higher", fmt: (v) => `${(v * 100).toFixed(1)}%` },
];

// --- Static Helpers (Copied from market_movers logic) ---
function fmtSigned(x, digits = 2) {
    const sign = x >= 0 ? "+" : "";
    return `${sign}${x.toFixed(digits)}`;
}

const MoversSummaryModal = ({ isOpen, onClose, dataProvider, segmentKey, priorQuarter, currentQuarter, perspectiveBankName, focusBankCert, authRequired = true }) => {
    const [summary, setSummary] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadStep, setLoadStep] = useState('');
    const [error, setError] = useState(null);
    const [isCopied, setIsCopied] = useState(false);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [retryCountdown, setRetryCountdown] = useState(null);
    const [retryCount, setRetryCount] = useState(0);
    const { user } = useAuth();

    useEffect(() => {
        if (isOpen && !summary && !isLoading && !error && (user || !authRequired)) {
            generateMoversIntelligence();
        } else if (isOpen && !user && !isLoginModalOpen && authRequired) {
            setIsLoginModalOpen(true);
        }
    }, [isOpen, user, authRequired, summary, isLoading, error, isLoginModalOpen]);

    useEffect(() => {
        let interval;
        if (retryCountdown !== null && retryCountdown > 0) {
            interval = setInterval(() => {
                setRetryCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        setRetryCountdown(null);
                        setRetryCount(prevCount => prevCount + 1);
                        generateMoversIntelligence();
                        return null;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [retryCountdown]);

    const handleLoginSuccess = () => {
        setIsLoginModalOpen(false);
        generateMoversIntelligence();
    };

    const generateMoversIntelligence = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // 1. Fetch Data
            setLoadStep('Mapping market movers...');
            const peerBanks = await dataProvider.listPeerBanks({ segmentKey, quarter: currentQuarter, focusCert: focusBankCert });

            setLoadStep('Fetching peer performance metrics...');
            const quarters = [priorQuarter, currentQuarter];
            const kpiPerCertPerQuarter = {};
            for (const b of peerBanks) kpiPerCertPerQuarter[b.cert] = {};

            for (const q of quarters) {
                const results = await Promise.allSettled(
                    peerBanks.map(async (b) => {
                        return { cert: b.cert, kpis: await dataProvider.getBankKpis({ cert: b.cert, quarter: q }) };
                    })
                );
                results.forEach((r, i) => {
                    const cert = peerBanks[i].cert;
                    kpiPerCertPerQuarter[cert][q] = (r.status === "fulfilled") ? r.value.kpis : null;
                });
            }

            const completePeers = peerBanks.filter(b => quarters.every(q => kpiPerCertPerQuarter[b.cert][q] !== null));
            if (completePeers.length < 5) throw new Error("Insufficient peer data for market analysis.");

            // 2. Compute Moves
            setLoadStep('Analyzing competitive anomalies...');
            const deltasByCert = {};
            for (const b of completePeers) {
                const q1 = kpiPerCertPerQuarter[b.cert][priorQuarter];
                const q2 = kpiPerCertPerQuarter[b.cert][currentQuarter];
                deltasByCert[b.cert] = KPI_SPECS.reduce((acc, spec) => {
                    acc[spec.key] = (q2[spec.key] || 0) - (q1[spec.key] || 0);
                    return acc;
                }, {});
            }

            const metricStats = {};
            KPI_SPECS.forEach(spec => {
                const vals = completePeers.map(b => deltasByCert[b.cert][spec.key]).sort((a, b) => a - b);
                const mean = vals.reduce((sum, v) => sum + v, 0) / vals.length;
                const variance = vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / vals.length;
                const median = vals.length % 2 !== 0
                    ? vals[Math.floor(vals.length / 2)]
                    : (vals[Math.floor((vals.length - 1) / 2)] + vals[Math.floor(vals.length / 2)]) / 2;
                metricStats[spec.key] = { mean, median, stdDev: Math.sqrt(variance) || 1, sortedVals: vals };
            });

            const rankedMovers = completePeers.map(b => {
                const deltas = deltasByCert[b.cert];
                const zScores = {};
                const stats = {};
                let surprise = 0;
                let validKpis = 0;

                KPI_SPECS.forEach(spec => {
                    const val = deltas[spec.key];
                    const { mean, stdDev, sortedVals, median } = metricStats[spec.key];
                    let z = (val - mean) / stdDev;
                    if (spec.better === 'lower') z = -z;
                    zScores[spec.key] = z;

                    // calculate percentile (delta_pct) bounds [0..1]
                    const idx = sortedVals.indexOf(val);
                    const delta_pct = Math.max(0, Math.min(1, idx / Math.max(1, sortedVals.length - 1)));

                    // calculate vs_peers_effect
                    let vs_peers_effect = 'equal_to_median';
                    if (val > median) {
                        vs_peers_effect = spec.better === 'higher' ? 'better_than_median' : 'worse_than_median';
                    } else if (val < median) {
                        vs_peers_effect = spec.better === 'lower' ? 'better_than_median' : 'worse_than_median';
                    }

                    stats[spec.key] = { delta_pct, median, vs_peers_effect };

                    // Exclude non-core metric classes from surprise score aggregation
                    if (spec.metric_class === 'core') {
                        surprise += Math.abs(z);
                        validKpis++;
                    }
                });

                const cappedSurprise = Math.min(surprise / (validKpis || 1), 5);

                const topDrivers = KPI_SPECS
                    .map(spec => ({
                        spec,
                        z: zScores[spec.key],
                        signedZ: spec.better === 'lower' ? -zScores[spec.key] : zScores[spec.key],
                        absZ: Math.abs(zScores[spec.key]),
                        delta: deltas[spec.key],
                        stats: stats[spec.key]
                    }))
                    .sort((a, b) => b.absZ - a.absZ)
                    .slice(0, 3);

                // Determine Computed Confidence
                let computedConfidence = "Low";
                const primaryDriver = topDrivers[0];
                const isPrimaryCore = primaryDriver.spec.metric_class === 'core';

                const highStrengthDrivers = topDrivers.filter(d => d.absZ >= 1.5);
                const sameDirectionCount = highStrengthDrivers.filter(d => d.stats.vs_peers_effect === primaryDriver.stats.vs_peers_effect).length;

                if (isPrimaryCore && highStrengthDrivers.length >= 2 && sameDirectionCount >= 2) {
                    computedConfidence = "High";
                } else if (isPrimaryCore && highStrengthDrivers.length >= 1) {
                    computedConfidence = "Medium";
                }

                return {
                    cert: b.cert,
                    bankName: b.name,
                    deltas,
                    zScores,
                    surprise: cappedSurprise,
                    topDrivers,
                    computedConfidence
                };
            }).sort((a, b) => b.surprise - a.surprise);

            const threatsList = rankedMovers.slice(0, 5);
            const focusRank = rankedMovers.findIndex(m => m.cert === focusBankCert) + 1;

            let tapeStr = "";
            let snapshotBlock = "";

            if (threatsList.length > 0) {
                tapeStr += "TOP QOQ MOVERS:\n";
                threatsList.forEach((m, idx) => {
                    const q2 = kpiPerCertPerQuarter[m.cert][currentQuarter];
                    tapeStr += `${idx + 1}. ${m.bankName} (Surprise: ${m.surprise.toFixed(2)}, Computed Confidence: ${m.computedConfidence})\n`;
                    m.topDrivers.forEach(d => {
                        let strength = "Low";
                        if (d.absZ >= 1.5) strength = "High";
                        else if (d.absZ >= 0.8) strength = "Medium";

                        const contextFlag = `[metric_class: ${d.spec.metric_class}]`;

                        // Inject strict units based on type
                        const unitStr = d.spec.type === 'rate' ? 'bp' : 'units';
                        // Convert delta to exact requested units (bp formatting here matches UI scale roughly)
                        const exactDeltaVal = d.spec.type === 'rate' ? Math.round(d.delta * 10000) : d.delta;
                        const exactMedianVal = d.spec.type === 'rate' ? Math.round(d.stats.median * 10000) : d.stats.median;

                        let impactStr = "";
                        if (d.spec.base_key && q2 && q2[d.spec.base_key]) {
                            // FDIC amounts are in thousands ($000s). We convert to Millions.
                            const baseMillions = q2[d.spec.base_key] / 1000;
                            const dollarImpactMillions = d.delta * baseMillions;
                            // Annualize the delta for rate metrics, NPL is a stock so don't annualize it
                            const annualizedImpact = d.spec.key === 'npl_ratio' ? dollarImpactMillions : dollarImpactMillions * 4;
                            impactStr = ` | Est. Annualized Impact: ${annualizedImpact >= 0 ? '+' : '-'}$${Math.abs(annualizedImpact).toFixed(1)}M`;
                        }

                        tapeStr += `  - Driver: ${d.spec.label} | Z-Score: ${fmtSigned(d.z)} | Strength: ${strength} | Delta: ${fmtSigned(exactDeltaVal, 0)} ${unitStr} | Peer Median: ${fmtSigned(exactMedianVal, 0)} ${unitStr} (delta_pct=${d.stats.delta_pct.toFixed(2)}, effect=${d.stats.vs_peers_effect}) ${contextFlag}${impactStr}\n`;
                    });
                });
            }

            snapshotBlock = `\nPERSPECTIVE SNAPSHOT (Your Bank):\nBank: ${perspectiveBankName}\nQuarter: ${currentQuarter}\nRelative Volatility Rank: ${focusRank > 0 ? focusRank : 'N/A'} of ${completePeers.length}\n`;

            setLoadStep('Synthesizing brief via Gemini...');

            const response = await fetch('/api/insights', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-linkedin-sub': user?.sub || 'anonymous',
                    'x-linkedin-name': user?.name || ''
                },
                body: JSON.stringify({
                    type: 'market_movers',
                    tapeStr,
                    snapshotBlock,
                    perspectiveBankName
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMsg = errorData.error || response.statusText;

                if (response.status === 429) {
                    // Check if this is a daily quota or a rate limit
                    if (errorMsg.toLowerCase().includes('daily quota')) {
                        throw new Error("DAILY_QUOTA: Daily AI quota reached (2/2). Try again tomorrow.");
                    }
                    // Otherwise it's likely a Gemini rate limit (retryable)
                    throw new Error(`RATE_LIMIT: ${errorMsg}`);
                }
                throw new Error(errorMsg || "Failed to generate intelligence brief.");
            }
            const resData = await response.json();
            const analysisData = resData.data || null;

            setSummary(analysisData);
            setRetryCount(0); // Reset retry tracker on success

        } catch (err) {
            console.error("Movers Error:", err);

            // Handle specific formatted errors from backend
            if (err.message.startsWith('RATE_LIMIT:')) {
                if (retryCount >= 1) {
                    setError("Daily AI quota reached. Please try again tomorrow.");
                    setRetryCountdown(null);
                } else {
                    const innerMsg = err.message.replace('RATE_LIMIT:', '').trim();
                    const match = innerMsg.match(/retry in (\d+\.?\d*)s/);
                    if (match && match[1]) {
                        const seconds = Math.ceil(parseFloat(match[1]));
                        setRetryCountdown(seconds);
                        setError(null);
                    } else {
                        setRetryCountdown(60);
                        setError(null);
                    }
                }
            } else if (err.message.startsWith('DAILY_QUOTA:')) {
                setError(err.message.replace('DAILY_QUOTA:', '').trim());
                setRetryCountdown(null);
            }
            // Handle raw Gemini SDK errors (when authRequired = false locally)
            else if (err.message && err.message.includes('429') && err.message.includes('quota')) {
                if (retryCount >= 1) {
                    setError("Daily AI quota reached. Please try again tomorrow.");
                    setRetryCountdown(null);
                } else {
                    const match = err.message.match(/retry in (\d+\.?\d*)s/);
                    if (match && match[1]) {
                        const seconds = Math.ceil(parseFloat(match[1]));
                        setRetryCountdown(seconds);
                        setError(null);
                    } else {
                        setRetryCountdown(60);
                        setError(null);
                    }
                }
            } else {
                setError(err.message || 'Failed to generate brief');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!summary || !summary.banks) return;

        // Convert the JSON payload back to a readable text/markdown format for copying
        let copyText = "";

        if (summary.ecosystem_synthesis) {
            copyText += `**ECOSYSTEM SYNTHESIS**\n`;
            copyText += `*${summary.ecosystem_synthesis.executive_summary}*\n\n`;
            copyText += `**Macro Opportunity:** ${summary.ecosystem_synthesis.macro_opportunity}\n\n`;
            copyText += `---\n\n`;
        }

        if (summary.banks) {
            summary.banks.forEach(bank => {
                copyText += `**${bank.bank_name}**\nTheme: ${bank.theme} (${bank.threat_level}) | Confidence: ${bank.confidence}\n\n`;

                if (bank.what_changed && bank.what_changed.length > 0) {
                    copyText += `What changed (QoQ):\n`;
                    bank.what_changed.forEach(change => {
                        copyText += `  • ${change.insight}\n    Evidence: ${change.evidence}\n`;
                    });
                    copyText += `\n`;
                }

                if (bank.so_what) {
                    copyText += `So what: ${bank.so_what}\n\n`;
                }

                if (bank.actions) {
                    copyText += `What ${perspectiveBankName} should do:\n`;
                    if (bank.actions.defend) copyText += `  • Defend: ${bank.actions.defend}\n`;
                    if (bank.actions.attack) copyText += `  • Attack: ${bank.actions.attack}\n`;
                    if (bank.actions.monitor) copyText += `  • Monitor: ${bank.actions.monitor}\n`;
                    copyText += `\n`;
                }

                if (bank.watch_next_quarter) {
                    copyText += `Watch next quarter: ${bank.watch_next_quarter}\n\n`;
                }
                copyText += `---\n\n`;
            });
        }

        await navigator.clipboard.writeText(copyText.trim());
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    if (!isOpen) return null;

    const renderSummary = (data) => {
        if (!data || !data.banks || !Array.isArray(data.banks)) {
            return <p className="text-gray-500 italic text-center mt-10">Invalid or empty brief data.</p>;
        }

        return (
            <>
                {data.ecosystem_synthesis && (
                    <div className="mb-8 bg-indigo-50 border border-indigo-100 rounded-lg p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-indigo-800 bg-indigo-200/50 p-1.5 rounded-md">🌍</span>
                            <h3 className="text-lg font-black text-indigo-900 tracking-tight uppercase">Ecosystem Synthesis</h3>
                        </div>
                        <p className="text-indigo-900 leading-relaxed mb-4 text-sm font-medium">
                            {data.ecosystem_synthesis.executive_summary}
                        </p>
                        <div className="bg-white border border-indigo-100 rounded p-3">
                            <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">Macro Opportunity</span>
                            <p className="text-sm text-gray-800 font-semibold">{data.ecosystem_synthesis.macro_opportunity}</p>
                        </div>
                    </div>
                )}

                {data.banks.map((bank, idx) => {
                    let confColor = "bg-gray-100 text-gray-800";
                    if (bank.confidence === "High") confColor = "bg-green-100 text-green-800 border border-green-200";
                    if (bank.confidence === "Medium") confColor = "bg-yellow-100 text-yellow-800 border border-yellow-200";
                    if (bank.confidence === "Low") confColor = "bg-red-50 text-red-700 border border-red-200";

                    return (
                        <div key={`bank-${idx}`}>
                            {/* Header Block */}
                            <div className="mt-8 mb-4 border-l-4 border-blue-800 pl-4 py-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-blue-50/30 rounded-r-lg pr-4">
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 tracking-tight">{bank.bank_name}</h3>
                                    <p className="text-blue-800 font-semibold text-sm mt-0.5">
                                        Theme: {bank.theme}
                                        {bank.threat_level && ` (${bank.threat_level})`}
                                    </p>
                                </div>
                                {bank.confidence && (
                                    <div className={`px-2.5 py-1 rounded-md text-xs font-bold shadow-sm whitespace-nowrap ${confColor}`}>
                                        {bank.confidence} Confidence
                                    </div>
                                )}
                            </div>

                            {/* What Changed */}
                            {bank.what_changed && bank.what_changed.length > 0 && (
                                <div className="mb-6">
                                    <h4 className="font-bold text-blue-900 border-b border-gray-100 pb-1 mb-3 uppercase tracking-wider text-[11px]">What changed (QoQ):</h4>
                                    <div className="text-gray-700 space-y-2">
                                        {bank.what_changed.map((change, cIdx) => (
                                            <div key={`change-${idx}-${cIdx}`}>
                                                <div className="flex items-start ml-2 mt-2">
                                                    <span className="text-blue-500 mr-2 font-bold text-lg leading-none mt-0.5">•</span>
                                                    <span className="text-sm leading-relaxed">{change.insight}</span>
                                                </div>
                                                {change.evidence && (
                                                    <div className="ml-8 text-[13px] text-gray-600 font-mono bg-slate-50 p-2.5 border border-slate-200 rounded-md my-1 shadow-inner">
                                                        ↳ {change.evidence}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* So What */}
                            {bank.so_what && (
                                <div className="mb-6">
                                    <h4 className="font-bold text-blue-900 border-b border-gray-100 pb-1 mb-3 uppercase tracking-wider text-[11px]">So what:</h4>
                                    <p className="text-sm text-gray-700 leading-relaxed mb-4">{bank.so_what}</p>
                                </div>
                            )}

                            {/* Actions */}
                            {bank.actions && (
                                <div className="mb-6">
                                    <h4 className="font-bold text-blue-900 border-b border-gray-100 pb-1 mb-3 uppercase tracking-wider text-[11px]">What {perspectiveBankName} should do:</h4>
                                    <div className="text-gray-700 space-y-2">
                                        {bank.actions.defend && (
                                            <div className="flex items-start ml-2 mt-3">
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider mr-2 bg-blue-100 text-blue-800`}>DEFEND</span>
                                                <span className="text-sm pt-0.5 leading-relaxed">{bank.actions.defend}</span>
                                            </div>
                                        )}
                                        {bank.actions.attack && (
                                            <div className="flex items-start ml-2 mt-3">
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider mr-2 bg-emerald-100 text-emerald-800`}>ATTACK</span>
                                                <span className="text-sm pt-0.5 leading-relaxed">{bank.actions.attack}</span>
                                            </div>
                                        )}
                                        {bank.actions.monitor && (
                                            <div className="flex items-start ml-2 mt-3">
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider mr-2 bg-purple-100 text-purple-800`}>MONITOR</span>
                                                <span className="text-sm pt-0.5 leading-relaxed">{bank.actions.monitor}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Watch Next Quarter */}
                            {bank.watch_next_quarter && (
                                <div className="mb-6">
                                    <h4 className="font-bold text-blue-900 border-b border-gray-100 pb-1 mb-3 uppercase tracking-wider text-[11px]">Watch next quarter:</h4>
                                    <p className="text-sm text-gray-700 leading-relaxed mb-4">{bank.watch_next_quarter}</p>
                                </div>
                            )}

                            {/* Separator between banks, unless it's the last one */}
                            {idx < data.banks.length - 1 && (
                                <hr className="my-8 border-gray-200" />
                            )}
                        </div>
                    );
                })}
            </>
        );
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-blue-900/40 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-blue-100">
                <div className="p-6 border-b border-blue-50 flex justify-between items-center bg-gray-50/80">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-900 p-2 rounded-lg text-white">
                            📊
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-blue-900">Competitive Intelligence Brief</h3>
                            <p className="text-sm text-gray-500 mt-1">Market Movers Analysis • {currentQuarter}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-200">
                        ✕
                    </button>
                </div>

                <div className="overflow-y-auto p-8 flex-1 bg-white">
                    {retryCountdown !== null ? (
                        <div className="flex flex-col items-center justify-center h-64 space-y-6">
                            <div className="relative">
                                <div className="text-4xl font-mono text-blue-900 font-bold">{retryCountdown}</div>
                                <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 w-24 h-24">
                                    <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-blue-100" />
                                    <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="276" strokeDashoffset={276 - (retryCountdown / 60) * 276} className="text-blue-500 transition-all duration-1000 ease-linear" />
                                </svg>
                            </div>
                            <div className="text-center mt-4">
                                <h4 className="text-lg font-bold text-gray-900 mb-1">Catching our breath</h4>
                                <p className="text-gray-500 text-sm">Gemini free-tier rate limit reached. Auto-resuming shortly.</p>
                            </div>
                        </div>
                    ) : isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 space-y-6">
                            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-900 border-t-transparent"></div>
                            <div className="text-center">
                                <p className="text-gray-900 font-bold text-lg">{loadStep}</p>
                                <p className="text-gray-500 text-sm mt-1 italic">Computing Z-scores and anomaly detection...</p>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-lg max-w-2xl mx-auto my-10">
                            <h4 className="text-red-800 font-bold text-lg">Briefing Interrupted</h4>
                            <p className="mt-2 text-red-700">{error}</p>
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto">
                            {summary ? renderSummary(summary) : <p className="text-gray-500 italic text-center mt-10">Brief is empty.</p>}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center px-8">
                    <button onClick={handleCopy} disabled={!summary || isLoading} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-50 disabled:opacity-50">
                        {isCopied ? 'Copied!' : 'Copy Brief'}
                    </button>
                    <div className="flex gap-3">
                        <button onClick={generateMoversIntelligence} disabled={isLoading} className="px-5 py-2 bg-blue-50 border border-blue-100 text-blue-700 rounded-lg text-sm font-bold hover:bg-blue-100 disabled:opacity-50">
                            Regenerate
                        </button>
                        <button onClick={onClose} className="px-5 py-2 bg-blue-900 text-white rounded-lg text-sm font-bold hover:bg-black shadow-md">
                            Close
                        </button>
                    </div>
                </div>
            </div>

            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={() => {
                    setIsLoginModalOpen(false);
                    onClose();
                }}
                onLoginSuccess={handleLoginSuccess}
            />
        </div>
    );
};

export default MoversSummaryModal;
