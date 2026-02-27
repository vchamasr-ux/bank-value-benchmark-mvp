const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

let fetch;

// Parse command line arguments
const args = process.argv.slice(2);
let certId = null;
args.forEach(arg => {
    if (arg.startsWith('--cert=')) {
        certId = arg.split('=')[1];
    }
});

if (!certId) {
    console.error("Usage: node generate_tear_sheet.js --cert=<CERT_ID>");
    process.exit(1);
}

const OUTPUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ---------------------------------------------------------
// 1. Data Fetching & KPI Calculation (Ported from React App)
// ---------------------------------------------------------

const formatQuarter = (dateString) => {
    if (!dateString) return 'Missing Date';
    if (typeof dateString === 'string' && dateString.match(/^Q[1-4] \d{4}$/)) return dateString;
    if (dateString.length !== 8) return dateString;

    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    let q = '';
    if (month === '03') q = 'Q1';
    else if (month === '06') q = 'Q2';
    else if (month === '09') q = 'Q3';
    else if (month === '12') q = 'Q4';
    else return dateString;
    return `${q} ${year}`;
};

const calculateKPIs = (data, history = null) => {
    const val = (key) => parseFloat(data[key]) || 0;

    const nonInterestExp = val('NONIX');
    const nonInterestInc = val('NONII');
    const interestExp = val('INTEXP') || val('EINTEXP');
    const netInterestIncome = val('INTINC') - interestExp;
    const totalAssets = val('ASSET');
    const totalIncome = netInterestIncome + nonInterestInc;
    const totalLoans = val('LNLSNET');
    const interestIncome = val('INTINC');
    const numEmployees = val('NUMEMP');

    let efficiencyRatio = totalIncome > 0 ? (nonInterestExp / totalIncome) * 100 : 0;
    let costOfFunds = totalAssets > 0 ? (interestExp / totalAssets) * 100 : 0;
    let nonInterestIncomePercent = totalIncome > 0 ? (nonInterestInc / totalIncome) * 100 : 0;
    let yieldOnLoans = totalLoans > 0 ? (interestIncome / totalLoans) * 100 : 0;
    let netInterestMargin = totalAssets > 0 ? (netInterestIncome / totalAssets) * 100 : 0;
    let assetsPerEmployee = numEmployees > 0 ? (totalAssets * 1000) / numEmployees : 0;

    const netIncome = val('NETINC');
    const totalEquity = val('EQ');
    let returnOnEquity = totalEquity > 0 ? (netIncome / totalEquity) * 100 : 0;
    let returnOnAssets = totalAssets > 0 ? (netIncome / totalAssets) * 100 : 0;

    const nonCurrentLoans = val('NCLNLS');
    let nonPerformingLoansRatio = totalLoans > 0 ? (nonCurrentLoans / totalLoans) * 100 : 0;

    let assetGrowth3Y = 0, loanGrowth3Y = 0, depositGrowth3Y = 0;

    if (history && history.length >= 13) {
        const hVal = (record, key) => parseFloat(record[key]) || 0;
        const latest = history[0];
        const threeYearAgo = history[12];

        const calcCAGR = (curr, prev) => {
            const c = hVal(latest, curr);
            const p = hVal(threeYearAgo, prev);
            if (p <= 0 || c <= 0) return 0;
            return (Math.pow(c / p, 1 / 3) - 1) * 100;
        };

        assetGrowth3Y = calcCAGR('ASSET', 'ASSET');
        loanGrowth3Y = calcCAGR('LNLSNET', 'LNLSNET');
        depositGrowth3Y = calcCAGR('DEP', 'DEP');
    }

    return {
        reportDate: formatQuarter(data.REPDTE),
        efficiencyRatio: efficiencyRatio.toFixed(2),
        costOfFunds: costOfFunds.toFixed(2),
        nonInterestIncomePercent: nonInterestIncomePercent.toFixed(2),
        yieldOnLoans: yieldOnLoans.toFixed(2),
        netInterestMargin: netInterestMargin.toFixed(2),
        assetsPerEmployee: assetsPerEmployee.toFixed(0),
        returnOnEquity: returnOnEquity.toFixed(2),
        returnOnAssets: returnOnAssets.toFixed(2),
        nonPerformingLoansRatio: nonPerformingLoansRatio.toFixed(2),
        assetGrowth3Y: assetGrowth3Y.toFixed(2),
        loanGrowth3Y: loanGrowth3Y.toFixed(2),
        depositGrowth3Y: depositGrowth3Y.toFixed(2),
        raw: data
    };
};

const getBankFinancials = async (cert) => {
    const fields = 'REPDTE,ASSET,DEP,NUMEMP,INTINC,INTEXP,EINTEXP,NONII,NONIX,LNLSNET,NETINC,EQ,NCLNLS,STALP,NAME,CITY,STNAME';
    const url = `https://api.fdic.gov/banks/financials/?filters=CERT:${cert}&fields=${fields}&limit=16&sort_by=REPDTE&sort_order=DESC&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`FDIC Error: ${res.statusText}`);
    const data = await res.json();
    return data.data.map(item => item.data);
};

const getAssetGroupConfig = (assetSize) => {
    if (assetSize >= 250000000) return { filter: 'ASSET:[250000000 TO *]', name: '>$250B' };
    if (assetSize >= 100000000) return { filter: 'ASSET:[100000000 TO 250000000]', name: '$100B-$250B' };
    if (assetSize >= 50000000) return { filter: 'ASSET:[50000000 TO 100000000]', name: '$50B-$100B' };
    if (assetSize >= 10000000) return { filter: 'ASSET:[10000000 TO 50000000]', name: '$10B-$50B' };
    if (assetSize >= 1000000) return { filter: 'ASSET:[1000000 TO 10000000]', name: '$1B-$10B' };
    return { filter: 'ASSET:[0 TO 1000000]', name: '<$1B' };
};

const getPeerGroupBenchmark = async (assetSize, subjectState, targetBankKpis, historyParams) => {
    const { filter: assetFilter, name: groupName } = getAssetGroupConfig(assetSize);
    const fields = 'ASSET,DEP,NUMEMP,INTINC,INTEXP,EINTEXP,NONII,NONIX,LNLSNET,NETINC,EQ,NCLNLS,NAME,CITY,STNAME,STALP,CERT';
    const url = `https://api.fdic.gov/banks/financials/?filters=${encodeURIComponent(assetFilter)}%20AND%20ACTIVE:1&fields=${fields}&limit=50&sort_by=REPDTE&sort_order=DESC&format=json`;

    const response = await fetch(url);
    if (!response.ok) return null;
    const json = await response.json();

    const candidates = json.data.map(item => item.data);
    const peers = candidates.slice(0, 20);

    // Fetch history for 3Y Growth calculations for the peer group
    const peerCerts = peers.map(p => p.CERT).join(' OR ');
    const histUrl = `https://api.fdic.gov/banks/financials/?filters=CERT:(${peerCerts})%20AND%20REPDTE:20221231&fields=CERT,ASSET,LNLSNET,DEP&format=json`;
    let histMap = {};
    try {
        const histResponse = await fetch(histUrl);
        if (histResponse.ok) {
            const histJson = await histResponse.json();
            histMap = (histJson.data || []).reduce((acc, item) => {
                acc[item.data.CERT] = item.data;
                return acc;
            }, {});
        }
    } catch (e) {
        console.warn("Failed to fetch historical benchmarks.");
    }

    const peerKPIs = peers.map(d => {
        const kpis = calculateKPIs(d);
        const hist = histMap[d.CERT];
        if (hist) {
            const calcCAGR = (curr, prev) => {
                const c = parseFloat(curr) || 0;
                const p = parseFloat(prev) || 0;
                if (p <= 0 || c <= 0) return 0;
                return (Math.pow(c / p, 1 / 3) - 1) * 100;
            };
            kpis.assetGrowth3Y = calcCAGR(d.ASSET, hist.ASSET).toFixed(2);
            kpis.loanGrowth3Y = calcCAGR(d.LNLSNET, hist.LNLSNET).toFixed(2);
            kpis.depositGrowth3Y = calcCAGR(d.DEP, hist.DEP).toFixed(2);
        }
        return kpis;
    });

    const getPercentile = (arr, p) => {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const index = (p / 100) * (sorted.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index - lower;
        return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    };

    const metrics = [
        'efficiencyRatio', 'netInterestMargin', 'costOfFunds', 'nonInterestIncomePercent',
        'yieldOnLoans', 'returnOnEquity', 'returnOnAssets', 'nonPerformingLoansRatio',
        'assetGrowth3Y', 'loanGrowth3Y', 'depositGrowth3Y'
    ];
    const distributions = {};
    const means = {};

    metrics.forEach(metric => {
        const values = peerKPIs.map(k => parseFloat(k[metric])).filter(v => !isNaN(v) && v !== null);
        const sum = values.reduce((a, b) => a + b, 0);
        means[metric] = values.length > 0 ? (sum / values.length).toFixed(2) : "0.00";
        distributions[metric] = {
            p25: getPercentile(values, 25).toFixed(2),
            p75: getPercentile(values, 75).toFixed(2)
        };
    });

    // --- Market Movers Logic ---
    const priorQuarter = targetBankKpis.reportDate === historyParams[0].REPDTE ? historyParams[1]?.REPDTE : undefined; // we need a way to pass this in

    // For the standalone script, we'll calculate the deltas based on the most recent 2 quarters for the peers
    const fetchRecentPeersUrl = `https://api.fdic.gov/banks/financials/?filters=CERT:(${peerCerts})%20AND%20REPDTE:["20240101"%20TO%20"20241231"]&fields=CERT,REPDTE,ASSET,DEP,NUMEMP,INTINC,INTEXP,EINTEXP,NONII,NONIX,LNLSNET,NETINC,EQ,NCLNLS&limit=100&sort_by=REPDTE&sort_order=DESC&format=json`;

    let moversList = [];
    try {
        const moversRes = await fetch(fetchRecentPeersUrl);
        if (moversRes.ok) {
            const mJson = await moversRes.json();
            const rawData = mJson.data.map(d => d.data);

            // Group by cert
            const byCert = {};
            rawData.forEach(d => {
                if (!byCert[d.CERT]) byCert[d.CERT] = [];
                byCert[d.CERT].push(d);
            });

            const deltasByCert = {};
            const completePeers = [];

            Object.values(byCert).forEach(quartersArr => {
                // sort descending
                quartersArr.sort((a, b) => parseInt(b.REPDTE) - parseInt(a.REPDTE));
                if (quartersArr.length >= 2) {
                    const currentQ = quartersArr[0];
                    const priorQ = quartersArr[1];
                    const kpisCurrent = calculateKPIs(currentQ, quartersArr);
                    const kpisPrior = calculateKPIs(priorQ, quartersArr.slice(1));

                    const deltas = {};
                    metrics.forEach(m => {
                        deltas[m] = (parseFloat(kpisCurrent[m]) || 0) - (parseFloat(kpisPrior[m]) || 0);
                    });

                    completePeers.push({ cert: currentQ.CERT, name: peers.find(p => p.CERT === currentQ.CERT)?.NAME || '' });
                    deltasByCert[currentQ.CERT] = deltas;
                }
            });

            // Calculate metric stats (mean, stdDev) for z-scores
            const metricStats = {};
            metrics.forEach(m => {
                const vals = completePeers.map(b => deltasByCert[b.cert][m]).sort((a, b) => a - b);
                const mean = vals.reduce((sum, v) => sum + v, 0) / (vals.length || 1);
                const variance = vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (vals.length || 1);
                metricStats[m] = { mean, stdDev: Math.sqrt(variance) || 1 };
            });

            const specDirections = {
                efficiencyRatio: 'lower', netInterestMargin: 'higher', costOfFunds: 'lower',
                nonInterestIncomePercent: 'higher', yieldOnLoans: 'higher', returnOnEquity: 'higher',
                returnOnAssets: 'higher', nonPerformingLoansRatio: 'lower',
                assetGrowth3Y: 'higher', loanGrowth3Y: 'higher', depositGrowth3Y: 'higher'
            };

            moversList = completePeers.map(b => {
                const zScores = {};
                let surprise = 0;
                let validKpis = 0;

                metrics.forEach(m => {
                    const val = deltasByCert[b.cert][m];
                    const { mean, stdDev } = metricStats[m];
                    let z = (val - mean) / stdDev;
                    if (specDirections[m] === 'lower') z = -z;
                    zScores[m] = z;

                    // Only use core for surprise score
                    if (!m.includes('Growth')) {
                        surprise += Math.abs(z);
                        validKpis++;
                    }
                });

                const cappedSurprise = Math.min(surprise / (validKpis || 1), 5);

                const topDrivers = metrics.map(m => {
                    return {
                        key: m,
                        z: zScores[m],
                        absZ: Math.abs(zScores[m]),
                        delta: deltasByCert[b.cert][m]
                    };
                }).sort((a, b) => b.absZ - a.absZ).slice(0, 2); // top 2 drivers

                return { ...b, zScores, surprise: cappedSurprise, topDrivers, deltas: deltasByCert[b.cert] };
            }).sort((a, b) => b.surprise - b.surprise).slice(0, 3); // Top 3 movers

        }
    } catch (e) {
        console.error("Failed to calculate market movers", e);
    }

    return { groupName, means, p25: distributions, p75: distributions, moversList };
};

// ---------------------------------------------------------
// 2. AI Summarize
// ---------------------------------------------------------

const getAiSummary = async (promptText) => {
    const inputPath = path.join(__dirname, 'output', 'ai_summary_input.txt');
    const fallbackOutPath = path.join(__dirname, 'output', 'prompt_fallback.txt');

    if (fs.existsSync(inputPath)) {
        console.log("      Found ai_summary_input.txt, using manual AI summary.");
        return fs.readFileSync(inputPath, 'utf8');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn("      No GEMINI_API_KEY. Saving prompt to 'prompt_fallback.txt'.");
        if (!fs.existsSync(path.join(__dirname, 'output'))) fs.mkdirSync(path.join(__dirname, 'output'));
        fs.writeFileSync(fallbackOutPath, promptText);
        return "AI Summary unavailable (No API Key).";
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Timeout the API call to avoid hanging on retries when out of quota
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini API timeout')), 5000));
        const result = await Promise.race([
            model.generateContent(promptText),
            timeoutPromise
        ]);

        return result.response.text();
    } catch (e) {
        console.error("      AI Generation failed:", e.message);
        if (!fs.existsSync(path.join(__dirname, 'output'))) fs.mkdirSync(path.join(__dirname, 'output'));
        fs.writeFileSync(fallbackOutPath, promptText);
        return "AI Summary unavailable (No API Key).";
    }
};

// ---------------------------------------------------------
// 3. Main Execution
// ---------------------------------------------------------

const run = async () => {
    try {
        if (!fetch) {
            fetch = (await import('node-fetch')).default;
        }
        console.log(`[1/4] Fetching financials for CERT ${certId}...`);
        const history = await getBankFinancials(certId);
        if (!history) throw new Error("Bank not found.");

        const kpis = calculateKPIs(history[0], history);
        const bankDetails = history[0];
        console.log(`      ✓ Financials calculated.`);

        console.log(`[2/4] Fetching peer benchmarks for ${bankDetails.NAME}...`);
        const benchmarks = await getPeerGroupBenchmark(parseFloat(bankDetails.ASSET), bankDetails.STALP, kpis, history);
        console.log(`      ✓ Benchmarks generated for ${benchmarks.groupName}.`);

        console.log(`[3/4] Preparing Data Pipeline...`);
        console.log(`      ✓ Data aggregation complete.`);

        console.log(`[4/4] Rendering PDF...`);

        const formatKpi = (key) => {
            const val = parseFloat(kpis[key]) || 0;
            const p25 = benchmarks.p25[key] ? parseFloat(benchmarks.p25[key].p25) : 0;
            const p75 = benchmarks.p75[key] ? parseFloat(benchmarks.p75[key].p75) : 0;
            const mean = benchmarks.means[key] ? parseFloat(benchmarks.means[key]) : 0;

            const isInverse = key === 'efficiencyRatio' || key === 'costOfFunds' || key === 'nonPerformingLoansRatio';

            // Simple visual pos calculation
            const min = Math.min(val, p25) * 0.8 || (val * 0.5) || 0;
            const max = Math.max(val, p75) * 1.2 || (val * 1.5) || 100;
            const range = max - min;
            let leftPct = range === 0 ? 50 : ((val - min) / range) * 100;
            leftPct = Math.max(0, Math.min(100, leftPct));

            let statusColor = "bg-slate-500";
            if (!isInverse) {
                if (val >= p75) statusColor = "bg-emerald-500";
                else if (val <= p25) statusColor = "bg-rose-500";
                else statusColor = "bg-amber-400";
            } else {
                if (val <= p25) statusColor = "bg-emerald-500";
                else if (val >= p75) statusColor = "bg-rose-500";
                else statusColor = "bg-amber-400";
            }

            const formatNames = {
                efficiencyRatio: "Efficiency Ratio",
                netInterestMargin: "Net Interest Margin",
                costOfFunds: "Cost of Funds",
                nonInterestIncomePercent: "Non-Interest Inc %",
                yieldOnLoans: "Yield on Loans",
                returnOnEquity: "Return on Equity (ROE)",
                returnOnAssets: "Return on Assets (ROA)",
                nonPerformingLoansRatio: "NPL Ratio",
                assetGrowth3Y: "Asset Growth",
                loanGrowth3Y: "Loan Growth",
                depositGrowth3Y: "Deposit Growth"
            };

            return {
                name: formatNames[key] || key,
                value: val.toFixed(2) + '%',
                mean: mean.toFixed(2) + '%',
                leftPct: leftPct.toFixed(1),
                statusColor
            };
        };

        const coreKeys = ['returnOnAssets', 'returnOnEquity', 'netInterestMargin', 'efficiencyRatio', 'costOfFunds', 'nonInterestIncomePercent', 'yieldOnLoans', 'nonPerformingLoansRatio'];
        const growthKeys = ['assetGrowth3Y', 'loanGrowth3Y', 'depositGrowth3Y'];

        // --- Scenario Engine Logic ---
        console.log(`[x] Running Scenario Optimization Engine...`);
        const modelPath = path.join(__dirname, '../../public/models/whatwouldittake_tiered.json');
        let scenarios = null;

        try {
            if (fs.existsSync(modelPath)) {
                const modelData = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
                const assets = parseFloat(bankDetails.ASSET || 0);
                let tierKey = '<$1B';
                if (assets > 250000000) tierKey = '>$250B';
                else if (assets > 100000000) tierKey = '$100B-$250B';
                else if (assets > 50000000) tierKey = '$50B-$100B';
                else if (assets > 10000000) tierKey = '$10B-$50B';
                else if (assets > 1000000) tierKey = '$1B-$10B';

                const selectedTierModel = modelData.tiers[tierKey];
                if (selectedTierModel) {
                    const currentRoa = parseFloat(kpis.returnOnAssets);
                    const targetRoa = parseFloat(benchmarks.p75.returnOnAssets.p75);
                    const roaGap = targetRoa - currentRoa;

                    if (roaGap > 0) {
                        const targetModel = selectedTierModel.targets['returnOnAssets'];
                        const activeLevers = selectedTierModel.features;
                        const validLevers = [];

                        activeLevers.forEach((leverName, idx) => {
                            const coef = targetModel.coef[idx];
                            if (Math.abs(coef) < 0.0001) return;
                            let requiredMove = roaGap / coef;

                            // "Do No Harm" Banking Logic Check
                            const shouldBePositive = ['yieldOnLoans', 'nonInterestIncomePercent'].includes(leverName);
                            const shouldBeNegative = ['costOfFunds', 'efficiencyRatio', 'nptlRatio'].includes(leverName);

                            if (shouldBePositive && requiredMove < 0) return;
                            if (shouldBeNegative && requiredMove > 0) return;

                            validLevers.push({ id: leverName, coef: coef, prescribedDelta: requiredMove });
                        });

                        validLevers.sort((a, b) => Math.abs(b.coef) - Math.abs(a.coef));

                        if (validLevers.length >= 2) {
                            const formatNames = {
                                efficiencyRatio: "Efficiency Ratio", netInterestMargin: "NIM", costOfFunds: "Cost of Funds",
                                nonInterestIncomePercent: "Non-Int Inc %", yieldOnLoans: "Loan Yield", returnOnEquity: "ROE",
                                returnOnAssets: "ROA", nptlRatio: "NPL Ratio"
                            };

                            const formatMove = (moveId, cDelta) => {
                                const name = formatNames[moveId] || moveId;
                                const cVal = parseFloat(kpis[moveId]) || 0;
                                const tVal = cVal + cDelta;
                                return {
                                    name, currentVal: cVal.toFixed(2), targetVal: tVal.toFixed(2),
                                    deltaSign: cDelta > 0 ? '+' : '', deltaVal: cDelta.toFixed(2), tradeoff: null
                                };
                            };

                            // Balanced
                            const balancedShare = roaGap / validLevers.length;
                            const balancedPath = validLevers.map(lv => formatMove(lv.id, balancedShare / lv.coef));

                            // Aggressive 60/40
                            const topLever = validLevers[0];
                            const secondLever = validLevers[1];
                            const aggressivePath = [
                                formatMove(topLever.id, (roaGap * 0.6) / topLever.coef),
                                formatMove(secondLever.id, (roaGap * 0.4) / secondLever.coef)
                            ];

                            // Check tradeoffs for aggressive
                            const tradeoffs = selectedTierModel.tradeoffs ? selectedTierModel.tradeoffs[topLever.id] : null;
                            if (tradeoffs) {
                                let maxCorr = 0; let topTradeoff = null;
                                Object.entries(tradeoffs).forEach(([feat, corr]) => {
                                    if (feat !== topLever.id && Math.abs(corr) > Math.abs(maxCorr)) {
                                        maxCorr = corr; topTradeoff = feat;
                                    }
                                });
                                if (topTradeoff && maxCorr !== 0) {
                                    const tradeoffImpact = ((roaGap * 0.6) / topLever.coef) * maxCorr;
                                    if (Math.abs(tradeoffImpact) > 0.05) {
                                        aggressivePath[0].tradeoff = `${tradeoffImpact > 0 ? '+' : ''}${tradeoffImpact.toFixed(2)}% on ${formatNames[topTradeoff] || topTradeoff}`;
                                    }
                                }
                            }

                            scenarios = {
                                currentRoa: currentRoa.toFixed(2),
                                targetRoa: targetRoa.toFixed(2),
                                roaGap: roaGap.toFixed(2),
                                roaGapDollars: ((roaGap / 100) * (assets * 1000) / 1000000).toFixed(1),
                                balancedPath,
                                aggressivePath
                            };
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Failed to map scenarios", e);
        }

        console.log(`      ✓ Scenario Engine calculations complete.`);

        let scenarioContext = "Scenario Engine unable to find valid optimization paths.";
        if (scenarios) {
            scenarioContext = `
            Target: Top-Quartile ROA (${scenarios.targetRoa}%). Gap to close: +${scenarios.roaGap} points (~$${scenarios.roaGapDollars}M impact).
            Balanced Path recommended moves:
            ${scenarios.balancedPath.map(m => `- ${m.name}: ${m.deltaSign}${m.deltaVal} pts`).join('\n            ')}
            Aggressive Path recommended moves:
            ${scenarios.aggressivePath.map(m => `- ${m.name}: ${m.deltaSign}${m.deltaVal} pts ${m.tradeoff ? `(Tradeoff expected: ${m.tradeoff})` : ''}`).join('\n            ')}
            `;
        }

        const fallbackPromptText = `Act as an MBB (McKinsey/Bain/BCG) Banking Consultant preparing an executive intelligence brief.
You are evaluating: ${bankDetails.NAME} (FDIC CERT: ${certId}, Location: ${bankDetails.CITY}, ${bankDetails.STALP}).
Peer Segment constraint: ${benchmarks.groupName}.

Here is the complete financial context:

1. CORE SCORECARD (Current vs Peer Average):
- ROA: ${kpis.returnOnAssets}% (Avg: ${benchmarks.means.returnOnAssets}%)
- ROE: ${kpis.returnOnEquity}% (Avg: ${benchmarks.means.returnOnEquity}%)
- Net Interest Margin: ${kpis.netInterestMargin}% (Avg: ${benchmarks.means.netInterestMargin}%)
- Efficiency Ratio: ${kpis.efficiencyRatio}% (Avg: ${benchmarks.means.efficiencyRatio}%)
- Cost of Funds: ${kpis.costOfFunds}% (Avg: ${benchmarks.means.costOfFunds}%)
- Loan Yield: ${kpis.yieldOnLoans}% (Avg: ${benchmarks.means.yieldOnLoans}%)
- Non-Performing Loans: ${kpis.nonPerformingLoansRatio}% (Avg: ${benchmarks.means.nonPerformingLoansRatio}%)

2. STRATEGIC MOMENTUM (3-Year CAGR vs Peer Average):
- Asset Growth: ${kpis.assetGrowth3Y}% (Avg: ${benchmarks.means.assetGrowth3Y}%)
- Loan Growth: ${kpis.loanGrowth3Y}% (Avg: ${benchmarks.means.loanGrowth3Y}%)
- Deposit Growth: ${kpis.depositGrowth3Y}% (Avg: ${benchmarks.means.depositGrowth3Y}%)

3. SCENARIO OPTIMIZATION (Ridge Regression Output):
${scenarioContext}

INSTRUCTIONS:
Write a STRICTLY 3-paragraph executive narrative meant for the bank's C-suite.
Paragraph 1: Sector Context & Overall Posture (synthesize where they stand overall based on size and core KPIs).
Paragraph 2: Primary Strengths & Momentum (highlight what they are doing better than median).
Paragraph 3: Strategic Vulnerabilities & Prescriptive Actions (summarize the weakest points and explicitly tie in the scenario logic for how to reach top-quartile ROA).

DO NOT include pleasantries, bullet points, or intros like "Here is the summary." Produce just the 3 compelling paragraphs.`;

        console.log(`      Generating AI Summary with full context...`);
        const aiSummary = await getAiSummary(fallbackPromptText);

        const templateData = {
            bankName: bankDetails.NAME,
            city: bankDetails.CITY,
            state: bankDetails.STALP,
            cert: certId,
            reportDate: kpis.reportDate,
            peerGroup: benchmarks.groupName,
            coverImagePath: 'file:///C:/Users/vcham/.gemini/antigravity/brain/11d7dfd3-a7fc-4ee1-a46b-d1181d941df9/nano_banana_cover_1772218710372.png',
            aiSummary: aiSummary === "AI Summary unavailable (No API Key)." ? null : handlebars.Utils.escapeExpression(aiSummary).replace(/\n/g, '<br>'),
            aiFallbackPrompt: fallbackPromptText,
            coreKpis: coreKeys.map(formatKpi),
            growthKpis: growthKeys.map(formatKpi),
            scenarios: scenarios,
            movers: benchmarks.moversList.map(m => {
                const specDirections = {
                    efficiencyRatio: 'lower', netInterestMargin: 'higher', costOfFunds: 'lower',
                    nonInterestIncomePercent: 'higher', yieldOnLoans: 'higher', returnOnEquity: 'higher',
                    returnOnAssets: 'higher', nonPerformingLoansRatio: 'lower',
                    assetGrowth3Y: 'higher', loanGrowth3Y: 'higher', depositGrowth3Y: 'higher'
                };
                const drivers = m.topDrivers.map(d => {
                    const formatNames = {
                        efficiencyRatio: "Efficiency Ratio", netInterestMargin: "NIM", costOfFunds: "Cost of Funds",
                        nonInterestIncomePercent: "Non-Int Inc %", yieldOnLoans: "Loan Yield", returnOnEquity: "ROE",
                        returnOnAssets: "ROA", nonPerformingLoansRatio: "NPL Ratio"
                    };
                    const name = formatNames[d.key] || d.key;
                    const isRate = !d.key.includes('Growth');
                    const valStr = isRate ? `${(d.delta * 100).toFixed(0)} bp` : `${d.delta.toFixed(2)}%`;
                    const zStr = d.z > 0 ? `+${d.z.toFixed(1)}` : d.z.toFixed(1);
                    const color = (d.z > 0 && specDirections[d.key] === 'higher') || (d.z < 0 && specDirections[d.key] === 'lower') ? 'text-emerald-600' : 'text-rose-600';
                    const symbol = d.delta > 0 ? 'Δ +' : 'Δ -';
                    return { name, valStr, zStr, color, symbol };
                });
                return {
                    name: m.name.length > 20 ? m.name.substring(0, 20) + '...' : m.name,
                    drivers
                };
            })
        };

        console.log(`      Compiling Handlebars template...`);
        const templateHtml = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
        const template = handlebars.compile(templateHtml);
        const html = template(templateData);

        console.log(`      Launching Puppeteer...`);
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        console.log(`      Setting page content...`);
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const safeName = bankDetails.NAME.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const pdfPath = path.join(OUTPUT_DIR, `${safeName}_tear_sheet.pdf`);

        console.log(`      Printing PDF to ${pdfPath}...`);
        await page.pdf({
            path: pdfPath,
            format: 'Letter',
            printBackground: true,
            margin: { top: '0.4in', bottom: '0.4in', left: '0.4in', right: '0.4in' }
        });

        await browser.close();
        console.log(`✅ Success! PDF saved to: ${pdfPath}`);

        process.exit(0);

    } catch (error) {
        console.error("❌ Error during script execution:", error);
        process.exit(1);
    }
};

run();
