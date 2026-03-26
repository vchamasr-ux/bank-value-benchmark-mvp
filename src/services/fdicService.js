import { z } from 'zod';
import { calculateKPIs, calcCAGR } from '../utils/kpiCalculator.js';

const FDIC_API_BASE = 'https://api.fdic.gov/banks/institutions/';
const FDIC_FINANCIALS_URL = 'https://api.fdic.gov/banks/financials/';

// Zod Schema to strictly enforce FDIC API data shapes (Fail Loudly Doctrine)
const FdicFinancialReportSchema = z.object({
    REPDTE: z.union([z.string(), z.number()]),
    ASSET: z.union([z.string(), z.number()]).optional().nullable(),
    DEP: z.union([z.string(), z.number()]).optional().nullable(),
    NUMEMP: z.union([z.string(), z.number()]).optional().nullable(),
    INTINC: z.union([z.string(), z.number()]).optional().nullable(),
    INTEXP: z.union([z.string(), z.number()]).optional().nullable(),
    EINTEXP: z.union([z.string(), z.number()]).optional().nullable(),
    NONII: z.union([z.string(), z.number()]).optional().nullable(),
    NONIX: z.union([z.string(), z.number()]).optional().nullable(),
    LNLSNET: z.union([z.string(), z.number()]).optional().nullable(),
    NETINC: z.union([z.string(), z.number()]).optional().nullable(),
    EQ: z.union([z.string(), z.number()]).optional().nullable(),
    NCLNLS: z.union([z.string(), z.number()]).optional().nullable(),
    STALP: z.string().optional().nullable(),
    NAME: z.string().optional().nullable(),
    CITY: z.string().optional().nullable(),
    STNAME: z.string().optional().nullable(),
}).passthrough(); // Passthrough allows other unexpected fields to exist, but the core MUST be present.

const FdicApiResponseSchema = z.object({
    data: z.array(z.object({
        data: FdicFinancialReportSchema
    }).passthrough())
}).passthrough();

/**
 * Search for banks by name using the FDIC API.
 * @param {string} name - The name of the bank to search for.
 * @returns {Promise<Array>} - A promise that resolves to an array of bank objects.
 */
export const searchBank = async (name) => {
    if (!name) return [];

    const cacheKey = `fdic_search_${name.trim().toLowerCase()}`;
    try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) return JSON.parse(cached);
    } catch (e) {
        throw new Error(`Session storage read failed: ${e.message}`);
    }

    // FDIC API requires specific filters string format
    // We search for ACTIVE institutions using the flexible 'search' parameter
    const searchQuery = `NAME:"${name}" AND ACTIVE:1`;
    // Add BKCLASS to fields so we can filter on it client-side
    const fields = 'NAME,CITY,STNAME,STALP,CERT,BKCLASS';
    const limit = 10;
    
    const url = `${FDIC_API_BASE}?search=${encodeURIComponent(searchQuery)}&sort_by=ASSET&sort_order=DESC&fields=${fields}&limit=${limit}&format=json`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`FDIC API Error: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data || !Array.isArray(data.data)) {
            // Do not silently fallback
            throw new Error(`FDIC API returned an invalid data structure: expected an array but got ${typeof data?.data}`);
        }

        const results = data.data
            .map(item => item.data)
            .filter(bank => bank.BKCLASS !== 'NC' && bank.BKCLASS !== 'OI');

        if (results.length === 0) {
           throw new Error(`No active banks found matching "${name}".`);
        }

        try {
            sessionStorage.setItem(cacheKey, JSON.stringify(results));
        } catch (e) {
            console.warn(`Session storage write failed: ${e.message}`);
        }

        return results;
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

    // Fetch 20 quarters (5 years) to give the 3Y CAGR calculation a safety buffer
    // against any gaps in FDIC quarterly filings.
    const url = `${FDIC_FINANCIALS_URL}?filters=CERT:${certId}&fields=${fields}&limit=20&sort_by=REPDTE&sort_order=DESC&format=json`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`FDIC Financials Error: ${response.statusText}`);
        }

        const rawData = await response.json();

        // ZOD RUNTIME VALIDATION (Fail Loudly Doctrine - Rule 1 implementation)
        // This will explode explicitly with a ZodError if the FDIC shape unexpectedly changes.
        const parsedData = FdicApiResponseSchema.parse(rawData);

        if (parsedData.data.length > 0) {
            // Return array of historical records (sorted DESC by date)
            return parsedData.data.map(item => item.data);
        }
        return null;
    } catch (error) {
        console.error("Failed to fetch financials:", error);
        throw error; // Let the caller deal with the explicit failure (e.g. throwing a toast or crashing)
    }
};

/**
 * Determine the asset class group and filter string for peers.
 * @param {number} assetSize - Bank assets in thousands
 */
export const getAssetGroupConfig = (assetSize) => {
    if (assetSize >= 250000000) return { filter: 'ASSET:[250000000 TO *]', name: '>$250B' }; // G-SIB
    if (assetSize >= 100000000) return { filter: 'ASSET:[100000000 TO 250000000]', name: '$100B-$250B' }; // Super Regional
    if (assetSize >= 50000000) return { filter: 'ASSET:[50000000 TO 100000000]', name: '$50B-$100B' };
    if (assetSize >= 10000000) return { filter: 'ASSET:[10000000 TO 50000000]', name: '$10B-$50B' }; // Regional
    if (assetSize >= 1000000) return { filter: 'ASSET:[1000000 TO 10000000]', name: '$1B-$10B' }; // Community
    return { filter: 'ASSET:[0 TO 1000000]', name: '<$1B' };
};

/**
 * Fetch aggregate benchmark data for the bank's Asset Peer Group via the API cache.
 * @param {number} assetSize - The bank's total assets (in thousands).
 * @param {string} subjectState - The 2-letter state code of the subject bank (e.g. 'VA').
 * @returns {Promise<Object>} - The benchmark distributions and distributions.
 */
export const getPeerGroupBenchmark = async (assetSize, subjectState) => {
    if (!assetSize) return null;

    try {
        const queryParams = new URLSearchParams({
            assetSize: String(assetSize),
            ...(subjectState && { subjectState })
        });

        const url = `/api/benchmarks?${queryParams.toString()}`;
        const response = await fetch(url);

        if (!response.ok) {
            let errBody;
            try {
                errBody = await response.json();
            } catch {
                throw new Error(`CRITICAL: API returned status ${response.status} but body could not be parsed as JSON.`);
            }
            throw new Error(errBody.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error("Failed to fetch peer benchmarks from API:", error);
        throw new Error(`CRITICAL: API benchmark connection failed: ${error.message}`);
    }
};

/**
 * Adapter for MoversSummaryModal to fetch a list of peer banks.
 */
export const listPeerBanks = async ({ segmentKey }) => {
    const fields = 'NAME,CITY,STNAME,STALP,CERT';
    
    // FDIC API uses %20AND%20 for filters, or - for search, but for filters it's usually `filters=... AND NOT_BKCLASS...` 
    // Actually, FDIC `search` endpoint supports `-BKCLASS:NC`. The `filters` endpoint supports `-BKCLASS:NC`.
    let url = `https://api.fdic.gov/banks/institutions/?search=${encodeURIComponent('ACTIVE:1 AND -BKCLASS:NC AND -BKCLASS:OI')}&fields=${fields}&limit=20&sort_by=ASSET&sort_order=DESC&format=json`;

    if (segmentKey && segmentKey.includes('ASSET:')) {
        // Exclude foreign branches here too
        url = `https://api.fdic.gov/banks/institutions/?filters=${encodeURIComponent(segmentKey)}%20AND%20ACTIVE:1%20AND%20-BKCLASS:NC%20AND%20-BKCLASS:OI&fields=${fields}&limit=20&sort_by=ASSET&sort_order=DESC&format=json`;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch peers");
        const json = await response.json();

        // Fail loud if no data array
        if (!json.data || !Array.isArray(json.data)) {
            throw new Error(`CRITICAL: Expected json.data to be an array but got ${typeof json.data}`);
        }

        const seen = new Set();
        const peers = [];
        json.data.forEach(item => {
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
 * Adapter for MoversSummaryModal: fetches KPIs for a single bank at a specific quarter.
 *
 * ⚠️  UNIT CONTRACT — READ BEFORE REUSING:
 * All rate-based KPI fields (nim, roa, roe, eff_ratio, cost_of_funds, loan_yield,
 * non_int_income_pct, npl_ratio, *_growth_3y) are returned as DECIMAL fractions.
 *   e.g. ROA of 1.2% is returned as 0.012 — NOT as 1.2.
 *
 * This is intentional: MoversSummaryModal computes basis-point deltas (delta * 10000)
 * and Z-scores on these decimals, so the math expects the decimal representation.
 *
 * ❌ DO NOT pass these values directly to GaugeChart or StrategicPlannerTab —
 *    those components expect kpiCalculator.js output format (percentages, not decimals).
 *
 * Raw balance sheet fields (raw_assets, raw_loans, raw_deposits, raw_revenue, raw_equity)
 * are in FDIC thousands ($000s) — divide by 1000 for millions.
 *
 * @param {string} cert  - FDIC CERT number for the bank
 * @param {string} quarter - Quarter string e.g. "Q4 2025"
 * @returns {Promise<Object|null>} KPI payload (decimal units) or null if record not found
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
            assetGrowth3Y = calcCAGR(parseFloat(record.ASSET), parseFloat(baseRec.ASSET)) / 100;
            loanGrowth3Y = calcCAGR(parseFloat(record.LNLSNET), parseFloat(baseRec.LNLSNET)) / 100;
            depositGrowth3Y = calcCAGR(parseFloat(record.DEP), parseFloat(baseRec.DEP)) / 100;
        }

        const strictVal = (rawValue, key) => {
            if (rawValue === undefined || rawValue === null) {
                throw new Error(`CRITICAL DATA MISSING: Required field '${key}' is missing from FDIC record.`);
            }
            const parsed = parseFloat(rawValue);
            if (isNaN(parsed)) {
                throw new Error(`CRITICAL DATA INVALID: Field '${key}' contains non-numeric value '${rawValue}'.`);
            }
            return parsed;
        };

        return {
            asset_growth_3y: assetGrowth3Y,
            loan_growth_3y: loanGrowth3Y,
            deposit_growth_3y: depositGrowth3Y,
            eff_ratio: strictVal(rawKpis.efficiencyRatio, 'efficiencyRatio') / 100,
            nim: strictVal(rawKpis.netInterestMargin, 'netInterestMargin') / 100,
            cost_of_funds: strictVal(rawKpis.costOfFunds, 'costOfFunds') / 100,
            non_int_income_pct: strictVal(rawKpis.nonInterestIncomePercent, 'nonInterestIncomePercent') / 100,
            loan_yield: strictVal(rawKpis.yieldOnLoans, 'yieldOnLoans') / 100,
            assets_per_employee: strictVal(rawKpis.assetsPerEmployee, 'assetsPerEmployee'),
            roe: strictVal(rawKpis.returnOnEquity, 'returnOnEquity') / 100,
            roa: strictVal(rawKpis.returnOnAssets, 'returnOnAssets') / 100,
            npl_ratio: strictVal(rawKpis.nptlRatio, 'nptlRatio') / 100,
            raw_assets: strictVal(record.ASSET, 'ASSET'),
            raw_loans: strictVal(record.LNLSNET, 'LNLSNET'),
            raw_deposits: strictVal(record.DEP, 'DEP'),
            raw_revenue: strictVal(record.INTINC, 'INTINC') + strictVal(record.NONII, 'NONII'),
            raw_equity: strictVal(record.EQ, 'EQ')
        };

    } catch (e) {
        console.error("getBankKpis failed:", e);
        throw new Error(`FDIC API KPI connection failed: ${e.message}`);
    }
};
