import { kv } from "@vercel/kv";
import { calculateKPIs, calcCAGR } from "../src/utils/kpiCalculator.js";
import { getProximityScore } from "../src/utils/stateMapping.js";

const FDIC_FINANCIALS_URL = 'https://api.fdic.gov/banks/financials/';

const getAssetGroupConfig = (assetSize) => {
    if (assetSize >= 250000000) return { filter: 'ASSET:[250000000 TO *]', name: '>$250B' }; // G-SIB
    if (assetSize >= 100000000) return { filter: 'ASSET:[100000000 TO 250000000]', name: '$100B-$250B' }; // Super Regional
    if (assetSize >= 50000000) return { filter: 'ASSET:[50000000 TO 100000000]', name: '$50B-$100B' };
    if (assetSize >= 10000000) return { filter: 'ASSET:[10000000 TO 50000000]', name: '$10B-$50B' }; // Regional
    if (assetSize >= 1000000) return { filter: 'ASSET:[1000000 TO 10000000]', name: '$1B-$10B' }; // Community
    return { filter: 'ASSET:[0 TO 1000000]', name: '<$1B' };
};

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { assetSize, subjectState } = req.query;

    if (!assetSize || isNaN(parseFloat(assetSize))) {
        return res.status(400).json({ error: 'Valid assetSize is required' });
    }

    // "Fail Loudly" check for Redis capabilities
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        console.error("CRITICAL ERROR: KV_REST_API_URL or KV_REST_API_TOKEN is missing from environment.");
        return res.status(500).json({ error: 'Server configuration error: Redis is not configured. Missing KV credentials.' });
    }

    try {
        const assetSizeNum = parseFloat(assetSize);
        const { filter: assetFilter, name: groupName } = getAssetGroupConfig(assetSizeNum);

        const BENCH_CACHE_VERSION = 'v1';
        const cacheKey = `fdic_bench_${BENCH_CACHE_VERSION}_${assetFilter}_${subjectState || 'all'}`;

        // 1. Try to get cached benchmark from Redis
        const cached = await kv.get(cacheKey);
        if (cached) {
            return res.status(200).json(cached);
        }

        // 2. Cache Miss: Perform calculation
        const fields = 'ASSET,DEP,NUMEMP,INTINC,INTEXP,EINTEXP,NONII,NONIX,LNLSNET,NETINC,EQ,NCLNLS,NAME,CITY,STNAME,STALP,CERT';
        const limit = 500;
        const url = `${FDIC_FINANCIALS_URL}?filters=${encodeURIComponent(assetFilter)}%20AND%20ACTIVE:1&fields=${fields}&limit=${limit}&sort_by=REPDTE&sort_order=DESC&format=json`;

        const response = await fetch(url);
        if (!response.ok) {
            return res.status(response.status).json({ error: 'Failed to fetch from FDIC API' });
        }

        const json = await response.json();
        if (!json.data || json.data.length === 0) {
            return res.status(404).json({ error: 'No benchmark data found for this asset size.' });
        }

        const rawCandidates = json.data.map(item => item.data);
        const seenCerts = new Set();
        const candidates = [];

        for (const d of rawCandidates) {
            if (d.CERT && !seenCerts.has(d.CERT)) {
                seenCerts.add(d.CERT);
                candidates.push(d);
            }
        }

        if (subjectState) {
            candidates.sort((a, b) => {
                const scoreA = getProximityScore(subjectState, a.STALP);
                const scoreB = getProximityScore(subjectState, b.STALP);
                return scoreA - scoreB;
            });
        }

        const peers = candidates.slice(0, 20);
        if (peers.length < 4) {
            return res.status(404).json({ error: `Only ${peers.length} peers found for tier ${groupName} — insufficient for statistics.` });
        }

        // Fetch historical data
        const peerCerts = peers.map(p => p.CERT).join(' OR ');
        const histUrl = `https://api.fdic.gov/banks/financials/?filters=CERT:(${peerCerts})%20AND%20REPDTE:20221231&fields=CERT,ASSET,LNLSNET,DEP&format=json`;
        let histMap = {};

        const histResponse = await fetch(histUrl);
        if (!histResponse.ok) {
            throw new Error(`Failed to fetch historical benchmarks from FDIC (Status: ${histResponse.status})`);
        }

        const histJson = await histResponse.json();
        histMap = (histJson.data || []).reduce((acc, item) => {
            acc[item.data.CERT] = item.data;
            return acc;
        }, {});

        const totalRaw = peers.reduce((acc, d) => {
            const hist = histMap[d.CERT];
            const hasHist = !!hist;
            return {
                ASSET: acc.ASSET + (parseFloat(d.ASSET) || 0),
                HIST_ASSET: acc.HIST_ASSET + (hasHist ? (parseFloat(hist.ASSET) || 0) : 0),
                NUMEMP: acc.NUMEMP + (parseFloat(d.NUMEMP) || 0),
                INTINC: acc.INTINC + (parseFloat(d.INTINC) || 0),
                INTEXP: acc.INTEXP + (parseFloat(d.INTEXP) || parseFloat(d.EINTEXP) || 0),
                NONII: acc.NONII + (parseFloat(d.NONII) || 0),
                NONIX: acc.NONIX + (parseFloat(d.NONIX) || 0),
                LNLSNET: acc.LNLSNET + (parseFloat(d.LNLSNET) || 0),
                HIST_LNLSNET: acc.HIST_LNLSNET + (hasHist ? (parseFloat(hist.LNLSNET) || 0) : 0),
                DEP: acc.DEP + (parseFloat(d.DEP) || 0),
                HIST_DEP: acc.HIST_DEP + (hasHist ? (parseFloat(hist.DEP) || 0) : 0),
                NETINC: acc.NETINC + (parseFloat(d.NETINC) || 0),
                EQ: acc.EQ + (parseFloat(d.EQ) || 0),
                NCLNLS: acc.NCLNLS + (parseFloat(d.NCLNLS) || 0),
                count: acc.count + 1
            };
        }, { ASSET: 0, HIST_ASSET: 0, NUMEMP: 0, INTINC: 0, INTEXP: 0, NONII: 0, NONIX: 0, LNLSNET: 0, HIST_LNLSNET: 0, DEP: 0, HIST_DEP: 0, NETINC: 0, EQ: 0, NCLNLS: 0, count: 0 });

        const peerKPIs = [];
        const peerBanks = peers.map(d => {
            const kpis = calculateKPIs(d);
            if (kpis) {
                const hist = histMap[d.CERT];
                if (hist) {
                    kpis.assetGrowth3Y = calcCAGR(parseFloat(d.ASSET), parseFloat(hist.ASSET));
                    kpis.loanGrowth3Y = calcCAGR(parseFloat(d.LNLSNET), parseFloat(hist.LNLSNET));
                    kpis.depositGrowth3Y = calcCAGR(parseFloat(d.DEP), parseFloat(hist.DEP));
                }
                peerKPIs.push(kpis);
            }

            return {
                name: d.NAME,
                city: d.CITY,
                state: d.STNAME,
                stalp: d.STALP,
                asset: parseFloat(d.ASSET) || 0
            };
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
            'efficiencyRatio', 'netInterestMargin', 'costOfFunds',
            'nonInterestIncomePercent', 'yieldOnLoans', 'assetsPerEmployee',
            'returnOnEquity', 'returnOnAssets', 'nptlRatio',
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

        const result = {
            ...totalRaw,
            ...means,
            groupName,
            assetFilter,
            sampleSize: totalRaw.count,
            peerBanks,
            p25: {
                efficiencyRatio: distributions.efficiencyRatio.p25,
                netInterestMargin: distributions.netInterestMargin.p25,
                costOfFunds: distributions.costOfFunds.p25,
                nonInterestIncomePercent: distributions.nonInterestIncomePercent.p25,
                yieldOnLoans: distributions.yieldOnLoans.p25,
                assetsPerEmployee: distributions.assetsPerEmployee.p25,
                returnOnEquity: distributions.returnOnEquity.p25,
                returnOnAssets: distributions.returnOnAssets.p25,
                nptlRatio: distributions.nptlRatio.p25,
                assetGrowth3Y: distributions.assetGrowth3Y.p25,
                loanGrowth3Y: distributions.loanGrowth3Y.p25,
                depositGrowth3Y: distributions.depositGrowth3Y.p25
            },
            p75: {
                efficiencyRatio: distributions.efficiencyRatio.p75,
                netInterestMargin: distributions.netInterestMargin.p75,
                costOfFunds: distributions.costOfFunds.p75,
                nonInterestIncomePercent: distributions.nonInterestIncomePercent.p75,
                yieldOnLoans: distributions.yieldOnLoans.p75,
                assetsPerEmployee: distributions.assetsPerEmployee.p75,
                returnOnEquity: distributions.returnOnEquity.p75,
                returnOnAssets: distributions.returnOnAssets.p75,
                nptlRatio: distributions.nptlRatio.p75,
                assetGrowth3Y: distributions.assetGrowth3Y.p75,
                loanGrowth3Y: distributions.loanGrowth3Y.p75,
                depositGrowth3Y: distributions.depositGrowth3Y.p75
            }
        };

        // Cache the result in Redis (24 hours TTL = 86400 seconds)
        await kv.set(cacheKey, result, { ex: 86400 });

        return res.status(200).json(result);

    } catch (error) {
        console.error("Benchmark API Error:", error);
        return res.status(500).json({ error: error.message || "Failed to calculate peer benchmarks." });
    }
}
