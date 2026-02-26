import { getBankFinancials, getAssetGroupConfig } from '../../services/fdicService';
import { calculateKPIs } from '../../utils/kpiCalculator';
import { getProximityScore } from '../../utils/stateMapping';

/**
 * fdicAdapter.js
 * 
 * This file serves as a 'bridge' between your existing application logic
 * and the Market Movers sidecar. 
 */

function assert(cond, msg) {
    if (!cond) throw new Error(`[Adapter Error] ${msg}`);
}

export const sidecarDataProvider = {
    /**
     * listPeerBanks
     * IMPLEMENTATION A: Independent Dynamic Fetch
     * Replicates the main app's logic to find the same peer set.
     */
    async listPeerBanks({ focusCert }) {
        assert(focusCert, "A focus focusCert is required for dynamic peer search.");

        // 1. Fetch Focus Bank's context (Assets and State)
        const focusData = await getBankFinancials(focusCert);
        assert(focusData && focusData.length > 0, `Could not find focus bank data for CERT ${focusCert}`);
        const latestFocus = focusData[0];
        const assetSize = latestFocus.ASSET;
        const subjectState = latestFocus.STALP;

        const { filter: assetFilter } = getAssetGroupConfig(assetSize);
        const fields = 'NAME,CITY,STNAME,STALP,CERT,ASSET';
        const limit = 500; // Large sample to filter from

        // 2. Fetch Peers in same asset class
        const url = `https://api.fdic.gov/banks/financials/?filters=${encodeURIComponent(assetFilter)}%20AND%20ACTIVE:1&fields=${fields}&limit=${limit}&sort_by=REPDTE&sort_order=DESC&format=json`;

        const response = await fetch(url);
        assert(response.ok, `FDIC Peer Fetch failed: ${response.statusText}`);

        const json = await response.json();
        const rawCandidates = json.data.map(item => item.data);

        // 3. Deduplicate by CERT
        const seenCerts = new Set();
        const candidates = [];
        for (const d of rawCandidates) {
            if (d.CERT && !seenCerts.has(d.CERT)) {
                seenCerts.add(d.CERT);
                candidates.push(d);
            }
        }

        // 4. Proximity Sort (Matches PeerGroupModal logic)
        if (subjectState) {
            candidates.sort((a, b) => {
                const scoreA = getProximityScore(subjectState, a.STALP);
                const scoreB = getProximityScore(subjectState, b.STALP);
                return scoreA - scoreB;
            });
        }

        // 5. Take Top 20 (or less if not enough available)
        return candidates.slice(0, 20).map(d => ({
            cert: d.CERT,
            name: d.NAME,
            city: d.CITY,
            state: d.STALP,
            assetsUsd: d.ASSET * 1000
        }));
    },

    /**
     * getBankKpis
     * Here we map your existing calculateKPIs to the sidecar's strict 
     * decimal requirements.
     */
    async getBankKpis({ cert, quarter }) {
        // 1. Fetch historical record from FDIC
        const allFinancials = await getBankFinancials(cert);
        assert(allFinancials, `No financials found for cert ${cert}`);

        // Helper: "Q4 2024" -> "20241231"
        const quarterToRepdte = (qStr) => {
            const [q, year] = qStr.split(' ');
            const monthMap = { Q1: '0331', Q2: '0630', Q3: '0930', Q4: '1231' };
            return `${year}${monthMap[q]}`;
        };

        const targetDate = quarterToRepdte(quarter);
        const recordIndex = allFinancials.findIndex(d => d.REPDTE === targetDate);

        // FAIL LOUDLY if specific history is missing
        assert(recordIndex !== -1, `Missing historical record for ${quarter} (REPDTE: ${targetDate}) for cert ${cert}`);

        // 2. Run through YOUR existing calculator
        // We pass the slice of financials starting from this record to the latest record index
        // so calculateKPIs can see the 13 quarters of history needed for 3Y growth.
        const kpisArray = calculateKPIs(allFinancials.slice(recordIndex));
        const kpis = kpisArray[0];

        // 3. CONVERT STRINGS TO DECIMALS (The "Strictness" Bridge)
        // Sidecar wants 0.058, not "5.80"
        return {
            eff_ratio: parseFloat(kpis.efficiencyRatio) / 100,
            nim: parseFloat(kpis.netInterestMargin) / 100,
            cost_of_funds: parseFloat(kpis.costOfFunds) / 100,
            non_int_income_pct: parseFloat(kpis.nonInterestIncomePercent) / 100,
            loan_yield: parseFloat(kpis.yieldOnLoans) / 100,
            assets_per_employee: parseFloat(kpis.assetsPerEmployee) / 1_000_000, // convert to $M so tape reads "Δ +0.87M"
            roe: parseFloat(kpis.returnOnEquity) / 100,
            roa: parseFloat(kpis.returnOnAssets) / 100,
            npl_ratio: parseFloat(kpis.nonPerformingLoansRatio) / 100,
            asset_growth_3y: kpis.assetGrowth3Y ? parseFloat(kpis.assetGrowth3Y) / 100 : 0,
            loan_growth_3y: kpis.loanGrowth3Y ? parseFloat(kpis.loanGrowth3Y) / 100 : 0,
            deposit_growth_3y: kpis.depositGrowth3Y ? parseFloat(kpis.depositGrowth3Y) / 100 : 0
        };
    },

    /**
     * generateGeminiText
     * Secure proxy to Gemini via serverless endpoint.
     */
    async generateGeminiText({ prompt, type = 'market_movers' }) {
        try {
            const storedUser = JSON.parse(localStorage.getItem('auth_user') || '{}');
            const linkedinSub = storedUser.sub;

            if (!linkedinSub) {
                throw new Error("Authentication required to generate AI insights.");
            }

            const response = await fetch('/api/insights', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-linkedin-sub': linkedinSub
                },
                body: JSON.stringify({
                    type,
                    // For flexible prompts from the adapter, we send them as a 'prompt' 
                    // though our backend currently uses hardcoded templates for security.
                    // Let's adjust backend insights.js to also accept a raw prompt if needed,
                    // but better to keep it templated.
                    // For sidecar/market movers, we'll assume the 'market_movers' type handles it.
                    tapeStr: prompt // Map direct prompt to tapeStr for the market_movers template
                })
            });

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error("Daily AI quota reached (2/2). Reset at midnight UTC.");
                }
                throw new Error("Failed to generate AI insights.");
            }

            const data = await response.json();
            return data.text || "No summary generated.";
        } catch (error) {
            console.error("Gemini API Error (Sidecar):", error);
            throw error;
        }
    }
};
