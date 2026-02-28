const FDIC_API_BASE = 'https://banks.data.fdic.gov/api/institutions/';

/**
 * Search for banks by name using the FDIC API.
 * @param {string} name - The name of the bank to search for.
 * @returns {Promise<Array>} - A promise that resolves to an array of bank objects.
 */
export const searchBank = async (name) => {
    if (!name) return [];

    // FDIC API requires specific filters string format
    // We search for ACTIVE institutions using the flexible 'search' parameter
    // and sort by ASSET DESC to prioritize the largest banks.
    const searchQuery = `NAME:"${name}" AND ACTIVE:1`;
    const fields = 'NAME,CITY,STNAME,STALP,CERT';
    const limit = 10;

    const url = `${FDIC_API_BASE}?search=${encodeURIComponent(searchQuery)}&sort_by=ASSET&sort_order=DESC&fields=${fields}&limit=${limit}&format=json`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`FDIC API Error: ${response.statusText}`);
        }
        const data = await response.json();
        return data.data.map(item => item.data);
    } catch (error) {
        console.error("Failed to search banks:", error);
        throw error;
    }
};

/**
 * Fetch financial data for a specific bank by CERT ID.
 */
export const getBankFinancials = async (certId) => {
    if (!certId) return null;

    // Fetch historical reports (16 quarters for 4 years of context)
    const fields = 'REPDTE,ASSET,DEP,NUMEMP,INTINC,INTEXP,EINTEXP,NONII,NONIX,LNLSNET,NETINC,EQ,NCLNLS,STALP,NAME,CITY,STNAME';

    const url = `https://api.fdic.gov/banks/financials/?filters=CERT:${certId}&fields=${fields}&limit=16&sort_by=REPDTE&sort_order=DESC&format=json`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`FDIC Financials Error: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.data.length > 0) {
            // Return array of historical records (sorted DESC by date)
            return data.data.map(item => item.data);
        }
        return null;
    } catch (error) {
        console.error("Failed to fetch financials:", error);
        throw error;
    }
};


import { calculateKPIs } from '../utils/kpiCalculator.js';
import { getProximityScore } from '../utils/stateMapping.js';

/**
 * Determine the asset class group and filter string for peers.
 * @param {number} assetSize - Bank assets in thousands
 */
const getAssetGroupConfig = (assetSize) => {
    if (assetSize >= 250000000) return { filter: 'ASSET:[250000000 TO *]', name: '>$250B' }; // G-SIB
    if (assetSize >= 100000000) return { filter: 'ASSET:[100000000 TO 250000000]', name: '$100B-$250B' }; // Super Regional
    if (assetSize >= 50000000) return { filter: 'ASSET:[50000000 TO 100000000]', name: '$50B-$100B' };
    if (assetSize >= 10000000) return { filter: 'ASSET:[10000000 TO 50000000]', name: '$10B-$50B' }; // Regional
    if (assetSize >= 1000000) return { filter: 'ASSET:[1000000 TO 10000000]', name: '$1B-$10B' }; // Community
    return { filter: 'ASSET:[0 TO 1000000]', name: '<$1B' };
};

/**
 * Fetch aggregate benchmark data for the bank's Asset Peer Group via Sampling.
 * @param {number} assetSize - The bank's total assets (in thousands).
 * @param {string} subjectState - The 2-letter state code of the subject bank (e.g. 'VA').
 * @returns {Promise<Object>} - The raw aggregate financial data for the peer group.
 */
export const getPeerGroupBenchmark = async (assetSize, subjectState) => {
    if (!assetSize) return null;

    const { filter: assetFilter, name: groupName } = getAssetGroupConfig(assetSize);

    const fields = 'ASSET,DEP,NUMEMP,INTINC,INTEXP,EINTEXP,NONII,NONIX,LNLSNET,NETINC,EQ,NCLNLS,NAME,CITY,STNAME,STALP,CERT';
    // Fetch a larger sample (N=500) to find enough neighbors
    const limit = 500;

    // Using /financials to get actual list of banks
    // Added sort_by=REPDTE to ensure we get 2025/latest data
    const url = `https://api.fdic.gov/banks/financials/?filters=${encodeURIComponent(assetFilter)}%20AND%20ACTIVE:1&fields=${fields}&limit=${limit}&sort_by=REPDTE&sort_order=DESC&format=json`;

    try {
        const response = await fetch(url);
        if (!response.ok) return null;

        const json = await response.json();
        if (json.data && json.data.length > 0) {
            // Flatten to just the data objects
            const rawCandidates = json.data.map(item => item.data);

            // Deduplicate by CERT ID (keep only the first occurrence, which is latest due to sort)
            const seenCerts = new Set();
            const candidates = [];

            for (const d of rawCandidates) {
                // Ensure we have a CERT to check against
                // If distinct banks somehow share a CERT (unlikely) or it's missing, we might skip.
                // The API guarantees unique CERT for unique active institutions usually.
                if (d.CERT && !seenCerts.has(d.CERT)) {
                    seenCerts.add(d.CERT);
                    candidates.push(d);
                }
            }

            // Sort candidates by proximity to subjectState
            if (subjectState) {
                candidates.sort((a, b) => {
                    const scoreA = getProximityScore(subjectState, a.STALP);
                    const scoreB = getProximityScore(subjectState, b.STALP);
                    return scoreA - scoreB;
                });
            }

            // Slice top 20
            const peers = candidates.slice(0, 20);

            // Fetch 3rd-year historical data for these 20 peers to calculate growth benchmarks
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
                console.warn("Failed to fetch historical benchmarks, growth quartiles will be 0", e);
            }

            // Aggregate to handle potential data types, but we'll use Means for the KPIs
            const totalRaw = peers.reduce((acc, d) => {
                const hist = histMap[d.CERT];
                // Only include in aggregate if we have baseline history to avoid inflation
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

            // Initial aggregate growth for totals (weighted)
            // (Removed unused calcCAGR helper from this scope)

            // Extract peer bank details for the modal AND calculate distributions
            const peerKPIs = [];
            const peerBanks = peers.map(d => {
                // Calculate KPIs for this specific bank to build distribution
                const kpis = calculateKPIs(d);
                if (kpis) {
                    // Calculate growth KPIs if history exists
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

            // Helper to calculate percentiles
            const getPercentile = (arr, p) => {
                if (arr.length === 0) return 0;
                const sorted = [...arr].sort((a, b) => a - b);
                const index = (p / 100) * (sorted.length - 1);
                const lower = Math.floor(index);
                const upper = Math.ceil(index);
                const weight = index - lower;
                return sorted[lower] * (1 - weight) + sorted[upper] * weight;
            };

            // Metrics to calculate P25/P75 for
            const metrics = [
                'efficiencyRatio', 'netInterestMargin', 'costOfFunds',
                'nonInterestIncomePercent', 'yieldOnLoans', 'assetsPerEmployee',
                'returnOnEquity', 'returnOnAssets', 'nptlRatio',
                'assetGrowth3Y', 'loanGrowth3Y', 'depositGrowth3Y'
            ];
            const distributions = {};
            const means = {};

            metrics.forEach(metric => {
                // Parse values back to float because calculateKPIs returns strings
                const values = peerKPIs.map(k => parseFloat(k[metric])).filter(v => !isNaN(v) && v !== null);

                // Calculate Mean
                const sum = values.reduce((a, b) => a + b, 0);
                means[metric] = values.length > 0 ? (sum / values.length).toFixed(2) : "0.00";

                distributions[metric] = {
                    p25: getPercentile(values, 25).toFixed(2),
                    p75: getPercentile(values, 75).toFixed(2)
                };
            });

            return {
                ...totalRaw,
                ...means, // Directly provide Means as the primary benchmark values
                groupName,
                assetFilter, // Expose the actual asset filter string
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
        }
        return null;
    } catch (error) {
        console.error("Failed to fetch peer benchmarks:", error);
        throw new Error(`FDIC API benchmark connection failed: ${error.message}`);
    }
};

/**
 * Adapter for MoversSummaryModal to fetch a list of peer banks.
 */
export const listPeerBanks = async ({ segmentKey, focusCert }) => {
    const fields = 'NAME,CITY,STNAME,STALP,CERT';
    let url = `https://banks.data.fdic.gov/api/institutions/?search=${encodeURIComponent('ACTIVE:1')}&fields=${fields}&limit=20&sort_by=ASSET&sort_order=DESC&format=json`;

    if (segmentKey && segmentKey.includes('ASSET:')) {
        url = `https://banks.data.fdic.gov/api/institutions/?filters=${encodeURIComponent(segmentKey)}%20AND%20ACTIVE:1&fields=${fields}&limit=20&sort_by=ASSET&sort_order=DESC&format=json`;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch peers");
        const json = await response.json();

        // Deduplicate
        const seen = new Set();
        const peers = [];
        (json.data || []).forEach(item => {
            const cert = String(item.data.CERT);
            if (!seen.has(cert)) {
                seen.add(cert);
                peers.push({ cert, name: item.data.NAME });
            }
        });
        return peers;
    } catch (e) {
        console.error("listPeerBanks error:", e);
        throw new Error(`FDIC API peer list connection failed: ${e.message}`);
    }
};

/**
 * Adapter for MoversSummaryModal to fetch specific KPIs for a bank/quarter.
 */
export const getBankKpis = async ({ cert, quarter }) => {
    // 1. Fetch historical record from FDIC based on string parsing (quarter is like "Q4 2025")
    const dteMap = { "Q1": "0331", "Q2": "0630", "Q3": "0930", "Q4": "1231" };
    const parts = quarter.split(' ');
    const repDte = `${parts[1]}${dteMap[parts[0]]}`;

    const fields = 'REPDTE,ASSET,DEP,NUMEMP,INTINC,INTEXP,EINTEXP,NONII,NONIX,LNLSNET,NETINC,EQ,NCLNLS,STALP,NAME,CITY,STNAME';
    const url = `https://api.fdic.gov/banks/financials/?filters=CERT:${cert}%20AND%20REPDTE:${repDte}&fields=${fields}&limit=1&format=json`;

    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const json = await response.json();
        const record = json.data?.[0]?.data;
        if (!record) return null;

        // 2. Fetch baseline for Growth KPIs
        const baseYear = parseInt(parts[1]) - 3;
        const baseUrl = `https://api.fdic.gov/banks/financials/?filters=CERT:${cert}%20AND%20REPDTE:${baseYear}${dteMap[parts[0]]}&fields=ASSET,DEP,LNLSNET&limit=1&format=json`;
        const baseRes = await fetch(baseUrl);
        const baseJson = baseRes.ok ? await baseRes.json() : { data: [] };
        const baseRec = baseJson.data?.[0]?.data;

        // 3. Compute KPI mapping
        const rawKpis = calculateKPIs(record);

        let assetGrowth3Y = 0, loanGrowth3Y = 0, depositGrowth3Y = 0;
        if (baseRec) {
            const calcCAGR = (c, p) => (p > 0 && c > 0) ? (Math.pow(c / p, 1 / 3) - 1) : 0;
            assetGrowth3Y = calcCAGR(parseFloat(record.ASSET), parseFloat(baseRec.ASSET));
            loanGrowth3Y = calcCAGR(parseFloat(record.LNLSNET), parseFloat(baseRec.LNLSNET));
            depositGrowth3Y = calcCAGR(parseFloat(record.DEP), parseFloat(baseRec.DEP));
        }

        return {
            asset_growth_3y: assetGrowth3Y,
            loan_growth_3y: loanGrowth3Y,
            deposit_growth_3y: depositGrowth3Y,
            eff_ratio: parseFloat(rawKpis.efficiencyRatio) / 100,
            nim: parseFloat(rawKpis.netInterestMargin) / 100,
            cost_of_funds: parseFloat(rawKpis.costOfFunds) / 100,
            non_int_income_pct: parseFloat(rawKpis.nonInterestIncomePercent) / 100,
            loan_yield: parseFloat(rawKpis.yieldOnLoans) / 100,
            assets_per_employee: parseFloat(rawKpis.assetsPerEmployee),
            roe: parseFloat(rawKpis.returnOnEquity) / 100,
            roa: parseFloat(rawKpis.returnOnAssets) / 100,
            npl_ratio: parseFloat(rawKpis.nptlRatio) / 100,
            raw_assets: parseFloat(record.ASSET) || 0,
            raw_loans: parseFloat(record.LNLSNET) || 0,
            raw_deposits: parseFloat(record.DEP) || 0,
            raw_revenue: (parseFloat(record.INTINC) || 0) + (parseFloat(record.NONII) || 0),
            raw_equity: parseFloat(record.EQ) || 0
        };

    } catch (e) {
        console.error("getBankKpis failed:", e);
        throw new Error(`FDIC API KPI connection failed: ${e.message}`);
    }
};
