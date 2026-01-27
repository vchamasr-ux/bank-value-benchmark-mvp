const FDIC_API_BASE = 'https://banks.data.fdic.gov/api/institutions/';

/**
 * Search for banks by name using the FDIC API.
 * @param {string} name - The name of the bank to search for.
 * @returns {Promise<Array>} - A promise that resolves to an array of bank objects.
 */
export const searchBank = async (name) => {
    if (!name) return [];

    // FDIC API requires specific filters string format
    // We search for ACTIVE institutions where name contains the search term
    const filters = `NAME:*${name}* AND ACTIVE:1`;
    const fields = 'NAME,CITY,STNAME,CERT';
    const limit = 10;

    const url = `${FDIC_API_BASE}?filters=${encodeURIComponent(filters)}&fields=${fields}&limit=${limit}&format=json`;

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

    // Fetch latest report.
    const fields = 'REPDTE,ASSET,NUMEMP,INTINC,INTEXP,EINTEXP,NONII,NONIX,LNLSNET,NETINC,EQ,NCLNLS';

    const url = `https://api.fdic.gov/banks/financials/?filters=CERT:${certId}&fields=${fields}&limit=1&sort_by=REPDTE&sort_order=DESC&format=json`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`FDIC Financials Error: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.data.length > 0) {
            return data.data[0].data;
        }
        return null;
    } catch (error) {
        console.error("Failed to fetch financials:", error);
        throw error;
    }
};


import { calculateKPIs } from '../utils/kpiCalculator';

/**
 * Fetch aggregate benchmark data for the bank's Asset Peer Group via Sampling.
 * @param {number} assetSize - The bank's total assets (in thousands).
 * @returns {Promise<Object>} - The raw aggregate financial data for the peer group.
 */
export const getPeerGroupBenchmark = async (assetSize) => {
    if (!assetSize) return null;

    // Define Asset Classes (in Thousands)
    // Class 1: < $100M (100,000)
    // Class 2: $100M - $1B (1,000,000)
    // Class 3: $1B - $10B (10,000,000)
    // Class 4: > $10B

    let assetFilter = '';
    let groupName = '';

    if (assetSize < 100000) {
        assetFilter = 'ASSET:[0 TO 100000]';
        groupName = 'Assets < $100M';
    } else if (assetSize < 1000000) {
        assetFilter = 'ASSET:[100000 TO 1000000]';
        groupName = 'Assets $100M - $1B';
    } else if (assetSize < 10000000) {
        assetFilter = 'ASSET:[1000000 TO 10000000]';
        groupName = 'Assets $1B - $10B';
    } else {
        assetFilter = 'ASSET:[10000000 TO *]';
        groupName = 'Assets > $10B';
    }

    const fields = 'ASSET,NUMEMP,INTINC,INTEXP,EINTEXP,NONII,NONIX,LNLSNET,NETINC,EQ,NCLNLS,NAME,CITY,STNAME';
    // Fetch a sample of 20 banks in this tier
    const limit = 20;

    // Using /financials to get actual list of banks
    // Added sort_by=REPDTE to ensure we get 2025/latest data
    const url = `https://api.fdic.gov/banks/financials/?filters=${encodeURIComponent(assetFilter)}%20AND%20ACTIVE:1&fields=${fields}&limit=${limit}&sort_by=REPDTE&sort_order=DESC&format=json`;

    try {
        const response = await fetch(url);
        if (!response.ok) return null;

        const json = await response.json();
        if (json.data && json.data.length > 0) {
            // Revert: Calculate Aggregate of the sample
            const total = json.data.reduce((acc, curr) => {
                const d = curr.data;
                return {
                    ASSET: acc.ASSET + (parseFloat(d.ASSET) || 0),
                    NUMEMP: acc.NUMEMP + (parseFloat(d.NUMEMP) || 0),
                    INTINC: acc.INTINC + (parseFloat(d.INTINC) || 0),
                    INTEXP: acc.INTEXP + (parseFloat(d.INTEXP) || parseFloat(d.EINTEXP) || 0),
                    NONII: acc.NONII + (parseFloat(d.NONII) || 0),
                    NONIX: acc.NONIX + (parseFloat(d.NONIX) || 0),
                    LNLSNET: acc.LNLSNET + (parseFloat(d.LNLSNET) || 0),
                    NETINC: acc.NETINC + (parseFloat(d.NETINC) || 0),
                    EQ: acc.EQ + (parseFloat(d.EQ) || 0),
                    NCLNLS: acc.NCLNLS + (parseFloat(d.NCLNLS) || 0),
                    count: acc.count + 1
                };
            }, { ASSET: 0, NUMEMP: 0, INTINC: 0, INTEXP: 0, NONII: 0, NONIX: 0, LNLSNET: 0, NETINC: 0, EQ: 0, NCLNLS: 0, count: 0 });

            // Extract peer bank details for the modal AND calculate distributions
            const peerKPIs = [];
            const peerBanks = json.data.map(item => {
                const d = item.data;
                // Calculate KPIs for this specific bank to build distribution
                const kpis = calculateKPIs(d);
                if (kpis) {
                    peerKPIs.push(kpis);
                }

                return {
                    name: d.NAME,
                    city: d.CITY,
                    state: d.STNAME,
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
            const metrics = ['efficiencyRatio', 'netInterestMargin', 'costOfFunds', 'nonInterestIncomePercent', 'yieldOnLoans', 'assetsPerEmployee', 'returnOnEquity', 'returnOnAssets', 'nonPerformingLoansRatio'];
            const distributions = {};

            metrics.forEach(metric => {
                // Parse values back to float because calculateKPIs returns strings
                const values = peerKPIs.map(k => parseFloat(k[metric])).filter(v => !isNaN(v));
                distributions[metric] = {
                    p25: getPercentile(values, 25).toFixed(2),
                    p75: getPercentile(values, 75).toFixed(2)
                };
            });

            return {
                ...total,
                groupName,
                sampleSize: total.count,
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
                    nonPerformingLoansRatio: distributions.nonPerformingLoansRatio.p25
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
                    nonPerformingLoansRatio: distributions.nonPerformingLoansRatio.p75
                }
            };
        }
        return null;
    } catch (error) {
        console.error("Failed to fetch peer benchmarks:", error);
        return null;
    }
};
