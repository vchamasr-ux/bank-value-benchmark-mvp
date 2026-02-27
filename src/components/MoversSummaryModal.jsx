import React, { useState, useEffect } from 'react';
import { useAuth } from './auth/AuthContext';
import LoginModal from './auth/LoginModal';
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- KPI config: align keys to your existing KPI extraction ---
const KPI_SPECS = [
    { key: "asset_growth_3y", label: "3Y Asset Growth (CAGR)", better: "higher", type: "rate", metric_class: "derived" },
    { key: "loan_growth_3y", label: "3Y Loan Growth (CAGR)", better: "higher", type: "rate", metric_class: "derived" },
    { key: "deposit_growth_3y", label: "3Y Deposit Growth (CAGR)", better: "higher", type: "rate", metric_class: "derived" },
    { key: "eff_ratio", label: "Efficiency Ratio", better: "lower", type: "rate", metric_class: "core" },
    { key: "nim", label: "Net Interest Margin (NIM)", better: "higher", type: "rate", metric_class: "core" },
    { key: "cost_of_funds", label: "Cost of Funds", better: "lower", type: "rate", metric_class: "core" },
    { key: "non_int_income_pct", label: "Non-Interest Income %", better: "higher", type: "rate", metric_class: "core" },
    { key: "loan_yield", label: "Yield on Loans", better: "higher", type: "rate", metric_class: "core" },
    { key: "assets_per_employee", label: "Assets per Employee", better: "higher", type: "scalar", metric_class: "denominator-sensitive" },
    { key: "roe", label: "Return on Equity (ROE)", better: "higher", type: "rate", metric_class: "core" },
    { key: "roa", label: "Return on Assets (ROA)", better: "higher", type: "rate", metric_class: "core" },
    { key: "npl_ratio", label: "NPL Ratio", better: "lower", type: "rate", metric_class: "core" },
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
                const vals = completePeers.map(b => deltasByCert[b.cert][spec.key]);
                const mean = vals.reduce((sum, v) => sum + v, 0) / vals.length;
                const variance = vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / vals.length;
                metricStats[spec.key] = { mean, stdDev: Math.sqrt(variance) || 1 };
            });

            const rankedMovers = completePeers.map(b => {
                const deltas = deltasByCert[b.cert];
                const zScores = {};
                let surprise = 0;
                let validKpis = 0;

                KPI_SPECS.forEach(spec => {
                    const val = deltas[spec.key];
                    const { mean, stdDev } = metricStats[spec.key];
                    let z = (val - mean) / stdDev;
                    if (spec.better === 'lower') z = -z;
                    zScores[spec.key] = z;

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
                        delta: deltas[spec.key]
                    }))
                    .sort((a, b) => b.absZ - a.absZ)
                    .slice(0, 3);

                return {
                    cert: b.cert,
                    bankName: b.name,
                    deltas,
                    zScores,
                    surprise: cappedSurprise,
                    topDrivers
                };
            }).sort((a, b) => b.surprise - a.surprise);

            const threatsList = rankedMovers.slice(0, 3);
            const playbooksList = [...rankedMovers].sort((a, b) => a.surprise - b.surprise).slice(0, 3);
            const focusRank = rankedMovers.findIndex(m => m.cert === focusBankCert) + 1;

            let tapeStr = "";
            let snapshotBlock = "";

            if (threatsList.length > 0) {
                tapeStr += "TOP QOQ MOVERS (THREATS):\n";
                threatsList.forEach((m, idx) => {
                    tapeStr += `${idx + 1}. ${m.bankName} (Surprise: ${m.surprise.toFixed(2)})\n`;
                    m.topDrivers.forEach(d => {
                        let strength = "Low";
                        if (d.absZ >= 1.5) strength = "High";
                        else if (d.absZ >= 0.8) strength = "Medium";
                        const isContextOnly = d.spec.metric_class !== 'core';
                        const contextFlag = isContextOnly ? " [CONTEXT_ONLY: Require verification next quarter]" : "";

                        // Inject strict units based on type
                        const unitStr = d.spec.type === 'rate' ? 'bp' : 'units';
                        // Convert delta to exact requested units (bp formatting here matches UI scale roughly)
                        const exactDeltaVal = d.spec.type === 'rate' ? Math.round(d.delta * 10000) : d.delta;

                        tapeStr += `  - Driver: ${d.spec.label} | Z-Score: ${fmtSigned(d.z)} | Strength: ${strength} | Delta: ${fmtSigned(exactDeltaVal, 0)} ${unitStr}${contextFlag}\n`;
                    });
                });
            }

            snapshotBlock = `\nPERSPECTIVE SNAPSHOT (Your Bank):\nBank: ${perspectiveBankName}\nQuarter: ${currentQuarter}\nRelative Volatility Rank: ${focusRank > 0 ? focusRank : 'N/A'} of ${completePeers.length}\n`;

            setLoadStep('Synthesizing brief via Gemini...');
            let textResult = "";

            const isDev = import.meta.env.DEV;
            const devApiKey = import.meta.env.VITE_GEMINI_API_KEY;

            if (isDev && devApiKey && !authRequired) {
                console.log("DEV MODE: Calling Gemini API directly...");
                const genAI = new GoogleGenerativeAI(devApiKey);
                const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

                const prompt = `
You are an elite competitive intelligence analyst specializing in banking.
Analyze the following Market Movers tape, which tracks significant Quarter-over-Quarter (QoQ) shifts in peer bank financials for ${currentQuarter}. 
Write a concise, hard-hitting competitive brief strictly from the perspective of ${perspectiveBankName}.

[CRITICAL INSTRUCTION FOR TAPE INTERPRETATION: You MUST preserve the exact numerical units explicitly provided in the tape string (e.g., if it says "+14 bp", output "+14 bp"). Do NOT convert bases or append your own unit guesses.]

[CRITICAL INSTRUCTION FOR CONTEXT_ONLY METRICS: If a driver is tagged [CONTEXT_ONLY], your "Confidence" score for that bank must be downgraded to "Medium" or "Low", and you must explicitly mention that the metric needs verification in upcoming quarters.]

Output exactly 1-2 paragraphs for each top mover, structured as:
[BANK NAME] — Theme: [1 sentence synthesis] (Threat/Opportunity/Monitor) | Confidence: [High/Medium/Low]
What changed (QoQ): [Bullet points translating Z-scores into plain English, e.g., "Sharp deterioration in efficiency" OR "Outpacing peers in loan growth". Rely on 'Strength' indicator (High/Med/Low).]
So what: [What this means strategically for them vs the peer group.]
What ${perspectiveBankName} should do:
- Defend: [1 concrete defensive action]
- Attack: [1 concrete offensive action]
- Monitor: [1 metric to watch next quarter]

[CRITICAL PLAYBOOK RULES: FORBID internal housekeeping / inward-facing initiatives (e.g., "improve our efficiency", "streamline operations"). FORBID product-line speculation UNLESS explicitly supported by tape data (e.g., do not say "they are pushing wealth management").]

Watch next quarter: [Conditional IF/THEN signal based on trend confirmation.]

--- MARKET MOVERS TAPE ---
${tapeStr}
${snapshotBlock}
`.trim();

                const result = await model.generateContent(prompt);
                const response = await result.response;
                textResult = response.text();
            } else {
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
                textResult = resData.text || "No analysis generated.";
            }

            setSummary(textResult);
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
        if (!summary) return;
        await navigator.clipboard.writeText(summary);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    if (!isOpen) return null;

    const renderSummary = (text) => {
        return text.split('\n\n').map((paragraph, idx) => {
            let trimPara = paragraph.trim();
            if (!trimPara) return null;

            // Handle horizontal rules or separators
            if (trimPara.match(/^---/)) {
                return <hr key={`hr-${idx}`} className="my-8 border-gray-200" />;
            }

            // Handle Bank Title Blocks: CAPITAL ONE NATIONAL ASSN — Theme: Retreat from... | Confidence: Medium
            const titleMatch = trimPara.match(/^([^—]+)\s—\sTheme:\s([^|]+)(?:\s\|\sConfidence:\s(.+))?/);
            if (titleMatch) {
                const bankName = titleMatch[1].trim();
                const theme = titleMatch[2].trim();
                const confidence = titleMatch[3]?.trim();

                let confColor = "bg-gray-100 text-gray-800";
                if (confidence === "High") confColor = "bg-green-100 text-green-800 border border-green-200";
                if (confidence === "Medium") confColor = "bg-yellow-100 text-yellow-800 border border-yellow-200";
                if (confidence === "Low") confColor = "bg-red-50 text-red-700 border border-red-200";

                return (
                    <div key={`title-${idx}`} className="mt-8 mb-4 border-l-4 border-blue-800 pl-4 py-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-blue-50/30 rounded-r-lg pr-4">
                        <div>
                            <h3 className="text-xl font-black text-gray-900 tracking-tight">{bankName}</h3>
                            <p className="text-blue-800 font-semibold text-sm mt-0.5">Theme: {theme}</p>
                        </div>
                        {confidence && (
                            <div className={`px-2.5 py-1 rounded-md text-xs font-bold shadow-sm whitespace-nowrap ${confColor}`}>
                                {confidence} Confidence
                            </div>
                        )}
                    </div>
                );
            }

            // Handle Section Headers with content combined (What changed, So what, etc.)
            const sectionMatch = trimPara.match(/^(What changed \(QoQ\):|So what:|What .* should do:|Watch next quarter:)/);
            if (sectionMatch) {
                const lines = trimPara.split('\n');
                const headerLine = lines[0];
                const contentLines = lines.slice(1);

                // If it's just the header with no content, return just the header (content comes next paragraph)
                if (contentLines.length === 0) {
                    return <h4 key={`hdr-${idx}`} className="font-bold text-gray-900 text-base mb-2 mt-6 uppercase tracking-wider text-xs border-b border-gray-100 pb-1">{headerLine}</h4>;
                }

                return (
                    <div key={`sec-${idx}`} className="mb-6">
                        <h4 className="font-bold text-blue-900 border-b border-gray-100 pb-1 mb-3 uppercase tracking-wider text-[11px]">{headerLine}</h4>
                        <div className="text-gray-700 space-y-2">
                            {contentLines.map((line, lIdx) => {
                                const lineTrim = line.trim();
                                const isListItem = lineTrim.startsWith('•') || lineTrim.startsWith('-');
                                const content = isListItem ? lineTrim.substring(1).trim() : lineTrim;

                                // Evidence blocks
                                if (content.startsWith('Evidence:')) {
                                    return (
                                        <div key={`ev-${lIdx}`} className="ml-8 text-[13px] text-gray-600 font-mono bg-slate-50 p-2.5 border border-slate-200 rounded-md my-1 shadow-inner">
                                            {content.replace('Evidence:', '↳')}
                                        </div>
                                    );
                                }

                                // Defend / Attack / Monitor bullet styling
                                const playbookMatch = content.match(/^(Defend:|Attack:|Monitor:)(.*)/);
                                if (playbookMatch) {
                                    const type = playbookMatch[1];
                                    const text = playbookMatch[2].trim();

                                    let badgeColor = "bg-gray-100 text-gray-800";
                                    if (type === "Defend:") badgeColor = "bg-blue-100 text-blue-800";
                                    if (type === "Attack:") badgeColor = "bg-emerald-100 text-emerald-800";
                                    if (type === "Monitor:") badgeColor = "bg-purple-100 text-purple-800";

                                    return (
                                        <div key={`pb-${lIdx}`} className="flex items-start ml-2 mt-3">
                                            <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider mr-2 ${badgeColor}`}>{type.replace(':', '')}</span>
                                            <span className="text-sm pt-0.5 leading-relaxed">{text}</span>
                                        </div>
                                    );
                                }

                                return isListItem ? (
                                    <div key={`li-${lIdx}`} className="flex items-start ml-2 mt-2">
                                        <span className="text-blue-500 mr-2 font-bold text-lg leading-none mt-0.5">•</span>
                                        <span className="text-sm leading-relaxed">{content}</span>
                                    </div>
                                ) : <p key={`p-${lIdx}`} className="text-sm leading-relaxed mt-1">{content}</p>;
                            })}
                        </div>
                    </div>
                );
            }

            // Fallback for standard text (like "So what" paragraphs if they don't get joined)
            return (
                <p key={`fb-${idx}`} className="mb-4 text-sm text-gray-700 leading-relaxed">
                    {trimPara}
                </p>
            );
        });
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
