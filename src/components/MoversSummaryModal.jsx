import React, { useState, useEffect, useMemo } from 'react';
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
function sorted(values) { return [...values].sort((a, b) => a - b); }
function quantile(sortedVals, q) {
    if (sortedVals.length === 1) return sortedVals[0];
    const pos = (sortedVals.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return sortedVals[lo];
    const w = pos - lo;
    return sortedVals[lo] * (1 - w) + sortedVals[hi] * w;
}
function percentileRank(sortedVals, x) {
    let lo = 0;
    let hi = sortedVals.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (sortedVals[mid] <= x) lo = mid + 1;
        else hi = mid;
    }
    return sortedVals.length === 0 ? 0 : lo / sortedVals.length;
}
function fmtDelta(spec, delta) {
    if (!Number.isFinite(delta)) return "N/A";
    if (spec.type === "rate") {
        const bp = delta * 10000;
        const sign = bp >= 0 ? "+" : "";
        return `Δ ${sign}${bp.toFixed(0)} bp`;
    }
    const abs = Math.abs(delta);
    if (abs >= 1_000_000) {
        const m = delta / 1_000_000;
        const sign = m >= 0 ? "+" : "";
        return `Δ ${sign}${m.toFixed(2)}M`;
    }
    const sign = delta >= 0 ? "+" : "";
    return `Δ ${sign}${delta.toFixed(2)}`;
}
function fmtSigned(x, digits = 2) {
    const sign = x >= 0 ? "+" : "";
    return `${sign}${x.toFixed(digits)}`;
}

const MoversSummaryModal = ({ isOpen, onClose, dataProvider, segmentKey, segmentLabel, priorQuarter, currentQuarter, perspectiveBankName, focusBankCert, authRequired = true }) => {
    const [summary, setSummary] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadStep, setLoadStep] = useState('');
    const [error, setError] = useState(null);
    const [isCopied, setIsCopied] = useState(false);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [retryCountdown, setRetryCountdown] = useState(null);
    const { user } = useAuth();

    useEffect(() => {
        if (isOpen && !summary && !isLoading && !error && (user || !authRequired)) {
            generateMoversIntelligence();
        } else if (isOpen && !user && !isLoginModalOpen && authRequired) {
            setIsLoginModalOpen(true);
        }
    }, [isOpen, user, authRequired]);

    useEffect(() => {
        let timer;
        if (retryCountdown !== null && retryCountdown > 0) {
            timer = setInterval(() => {
                setRetryCountdown((prev) => prev - 1);
            }, 1000);
        } else if (retryCountdown === 0) {
            setRetryCountdown(null);
            setError(null);
            generateMoversIntelligence();
        }
        return () => clearInterval(timer);
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
                deltasByCert[b.cert] = {};
                for (const spec of KPI_SPECS) {
                    deltasByCert[b.cert][spec.key] = kpiPerCertPerQuarter[b.cert][currentQuarter][spec.key] - kpiPerCertPerQuarter[b.cert][priorQuarter][spec.key];
                }
            }

            const distByMetric = {};
            const statsByMetric = {};
            for (const spec of KPI_SPECS) {
                const vals = completePeers.map(b => deltasByCert[b.cert][spec.key]);
                const sv = sorted(vals);
                distByMetric[spec.key] = sv;
                statsByMetric[spec.key] = { p50: quantile(sv, 0.5), iqr: Math.max(quantile(sv, 0.75) - quantile(sv, 0.25), 0.0001) };
            }

            const rows = completePeers.map(bank => {
                const drivers = KPI_SPECS.map(spec => {
                    const delta = deltasByCert[bank.cert][spec.key];
                    const { p50, iqr } = statsByMetric[spec.key];
                    const z = (delta - p50) / iqr;
                    const absZ = Math.abs(Math.max(Math.min(z, 3), -3));
                    const strength = absZ >= 2 ? "High" : (absZ >= 1 ? "Medium" : "Low");
                    return { spec, delta, deltaPct: percentileRank(distByMetric[spec.key], delta), z, absZ, signedZ: spec.better === "higher" ? z : -z, effect: (spec.better === "higher" ? (delta > 0 ? "improving" : "deteriorating") : (delta < 0 ? "improving" : "deteriorating")), vsPeersEffect: (spec.better === "higher" ? (z > 0 ? "better_than_median" : "worse_than_median") : (-z > 0 ? "better_than_median" : "worse_than_median")), strength };
                }).sort((a, b) => b.absZ - a.absZ);

                return { cert: bank.cert, bankName: bank.name, direction: (drivers.reduce((acc, d) => acc + d.signedZ, 0) >= 0 ? "positive" : "negative"), surprise: drivers.reduce((acc, d) => acc + d.absZ, 0), driversTop3: drivers.slice(0, 3) };
            }).sort((a, b) => b.surprise - a.surprise);

            const rankByCert = new Map(rows.map((r, i) => [r.cert, i + 1]));
            const focusRow = rows.find(r => r.cert === focusBankCert);
            const focusRank = focusRow ? rankByCert.get(focusRow.cert) : null;

            // 3. Build Tape
            const tapeLines = [`Market Movers — ${segmentLabel} — ${currentQuarter} vs ${priorQuarter}`, `Peers: N=${completePeers.length}`, ""];
            rows.slice(0, 5).forEach((m, i) => {
                tapeLines.push(` ${i + 1}. ${m.bankName} | dir=${m.direction} | surprise=${m.surprise.toFixed(2)}`);
                m.driversTop3.forEach(d => {
                    const stats = statsByMetric[d.spec.key];
                    tapeLines.push(`    - ${d.spec.label}: ${fmtDelta(d.spec, d.delta)} | peer_median=${fmtDelta(d.spec, stats.p50)} | delta_pct=${d.deltaPct.toFixed(2)} | z=${fmtSigned(d.z)} | ${d.effect} | vs_peers_effect=${d.vsPeersEffect} | strength=${d.strength} | metric_class=${d.spec.metric_class}`);
                });
                tapeLines.push("");
            });
            if (focusRow) {
                tapeLines.push(`Focus bank: ${focusRow.bankName} (rank ${focusRank})`);
                tapeLines.push(` ${focusRank}. ${focusRow.bankName} | dir=${focusRow.direction} | surprise=${focusRow.surprise.toFixed(2)}`);
                focusRow.driversTop3.forEach(d => {
                    const stats = statsByMetric[d.spec.key];
                    tapeLines.push(`    - ${d.spec.label}: ${fmtDelta(d.spec, d.delta)} | peer_median=${fmtDelta(d.spec, stats.p50)} | delta_pct=${d.deltaPct.toFixed(2)} | z=${fmtSigned(d.z)} | ${d.effect} | vs_peers_effect=${d.vsPeersEffect} | strength=${d.strength} | metric_class=${d.spec.metric_class}`);
                });
            }
            const tapeStr = tapeLines.join("\n");

            // 4. Focus Snapshot
            let snapshotBlock = "";
            const focusKpis = kpiPerCertPerQuarter[focusBankCert]?.[currentQuarter];
            if (focusKpis) {
                const qByKey = {};
                const snapRows = [];
                for (const snap of SNAPSHOT_KPIS) {
                    const focusVal = focusKpis[snap.key];
                    if (!Number.isFinite(focusVal)) continue;
                    const sv = sorted(completePeers.map(p => kpiPerCertPerQuarter[p.cert][currentQuarter][snap.key]).filter(Number.isFinite));
                    const p25 = quantile(sv, 0.25), p50 = quantile(sv, 0.5), p75 = quantile(sv, 0.75);
                    const qL = (snap.better === "higher") ? (focusVal >= p75 ? "top quartile" : (focusVal <= p25 ? "bottom quartile" : "middle two quartiles")) : (focusVal <= p25 ? "top quartile" : (focusVal >= p75 ? "bottom quartile" : "middle two quartiles"));
                    qByKey[snap.key] = qL;
                    snapRows.push(`  - ${snap.label}: ${snap.fmt(focusVal)} (peer median: ${snap.fmt(p50)}) → ${qL}`);
                }
                const flags = [];
                if (qByKey.nim === "top quartile") flags.push("defend NIM leadership");
                if (qByKey.cost_of_funds === "bottom quartile") flags.push("arrest funding cost escalation");
                if (qByKey.eff_ratio === "bottom quartile") flags.push("improve cost discipline before scaling");
                if (!flags.length) flags.push("balanced offense and defense");

                snapshotBlock = `\n--- PERSPECTIVE BANK SNAPSHOT (${perspectiveBankName}) ---\n${snapRows.join("\n")}\nInferred posture: ${flags.join("; ")}\n`;
            }

            // 5. API Call via Serverless (with local DEV fallback)
            setLoadStep('Generating intelligence brief...');

            const isDev = import.meta.env.DEV;
            const devApiKey = import.meta.env.VITE_GEMINI_API_KEY;

            let textResult = "";

            if (isDev && devApiKey) {
                console.log("DEV MODE: Calling Gemini API directly from frontend for Market Movers...");
                const genAI = new GoogleGenerativeAI(devApiKey);
                const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

                const prompt = `
You are a competitive-intelligence analyst writing for senior bankers at ${perspectiveBankName}. Use ONLY the data in the tape below. Do not invent numbers or add facts not present in the tape.

--- DEFINITIONS ---
- "Δ" = QoQ change (current quarter minus prior quarter).
- delta_pct = percentile rank of a bank's delta within the peer group (0..1). It is NOT a percent change.
- z = robust z-score: (bank delta − peer median delta) / peer IQR. 
- strength = High / Medium / Low. Always use this 'strength' label to describe the magnitude of change, rather than interpreting raw z-scores.
- "improving / deteriorating" = objective direction relative to the metric's "better" side.
- "vs_peers_effect" = shows whether the bank moved in a more favorable direction than the median peer.

--- STRATEGIC PHRASING (Softened Intent) ---
Do NOT assert intent confidently (e.g., "prioritizing growth", "strategic pivot"). 
Instead, use pattern-based language: 
"The pattern is consistent with margin-first behavior, either strategic or driven by mix/funding conditions."
"Performance suggests a defensive posture in funding costs."

--- METRIC RULES & CAVEATS ---
1. EXACT UNITS: You MUST preserve the exact units shown in the tape for every metric (e.g., bp, %, ratio). Do not convert units.
2. CONTEXT-ONLY METRICS: If a metric is flagged as metric_class="derived" (e.g., 3Y Growth CAGR) or metric_class="denominator-sensitive" (e.g., Assets per Employee):
   - You may include it as a driver, but you MUST treat it primarily as context for other moves.
   - If it is the top driver, you MUST add specific caveat language (e.g., "CAGR-based; verify next quarter before concluding trend break" or "headcount effect possible; verify next quarter").
3. NOISY METRICS: Non-Interest Income % or Efficiency Ratio. At subsidiary level, these can be distorted by internal allocations. If a swing is catastrophic/unprecedented (strength=High), flag as "(possible data/reporting artifact)".

--- CONFIDENCE RUBRIC (Deterministic) ---
Assign exactly one Confidence: High / Medium / Low.
Identify the TOP DRIVER (highest strength).
- High   = Magnitude high (strength=High) AND at least 2 metrics agree on direction AND no fragile/noisy/derived metrics involved as the primary anchor.
- Medium = Magnitude high (strength=High) but only 1 metric supports the move OR signals are partially mixed.
- Low    = Magnitude high but driven by derived/denominator-sensitive metrics OR extreme single-metric outlier OR possible reporting/data artifact.

--- OUTPUT FORMAT (Exactly as shown) ---

[BANK NAME] — Theme: [theme label] ([Threat / Opportunity / Monitor]) | Confidence: [High / Medium / Low]
What changed (QoQ):
  • [Insight 1: One-sentence analytical observation using ordinal language ("worst in the peer set", "top quartile")]
    Evidence: [Numbers: "Metric Label: {bank_delta} QoQ, peer median {peer_median} (delta_pct={value}) | strength={strength}"]
  • [Insight 2: Analytical observation]
    Evidence: [Numbers line preserving exact units]
  • [Insight 3: Analytical observation]
    Evidence: [Numbers line preserving exact units]

So what: [2–3 sentences. Link the pattern to likely market behavior.]

What ${perspectiveBankName} should do:
  • Defend: [What external relationships to protect / what not to do.]
  • Attack: [Where to take expected market share / what wedge to use.]
  • Monitor: [What specific external signals/behavior to watch next quarter.]

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

        } catch (err) {
            console.error("Movers Error:", err);

            // Handle specific formatted errors from backend
            if (err.message.startsWith('RATE_LIMIT:')) {
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
            } else if (err.message.startsWith('DAILY_QUOTA:')) {
                setError(err.message.replace('DAILY_QUOTA:', '').trim());
                setRetryCountdown(null);
            }
            // Handle raw Gemini SDK errors (when authRequired = false locally)
            else if (err.message && err.message.includes('429') && err.message.includes('quota')) {
                const match = err.message.match(/retry in (\d+\.?\d*)s/);
                if (match && match[1]) {
                    const seconds = Math.ceil(parseFloat(match[1]));
                    setRetryCountdown(seconds);
                    setError(null);
                } else {
                    setRetryCountdown(60);
                    setError(null);
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
