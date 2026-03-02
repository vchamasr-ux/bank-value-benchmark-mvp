

/**
 * Pure CAGR calculator. current and prior must be in the same unit.
 * Returns the CAGR as a percentage (e.g. 5.23 means 5.23%).
 * Returns 0 if either value is non-positive.
 */
export const calcCAGR = (current, prior) => {
    if (prior <= 0 || current <= 0) return 0;
    return (Math.pow(current / prior, 1 / 3) - 1) * 100;
};

/**
 * Format YYYYMMDD to "Qx YYYY"
 */
const formatQuarter = (dateString) => {
    if (!dateString) return 'Missing Date';

    // Check if it's already formatted 'Qx YYYY'
    if (typeof dateString === 'string' && dateString.match(/^Q[1-4] \d{4}$/)) {
        return dateString;
    }

    // If not already formatted, proceed with YYYYMMDD parsing
    if (dateString.length !== 8) return dateString; // Fallback for invalid length

    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    let q = '';
    if (month === '03') q = 'Q1';
    else if (month === '06') q = 'Q2';
    else if (month === '09') q = 'Q3';
    else if (month === '12') q = 'Q4';
    else return dateString; // Fallback
    return `${q} ${year}`;
};

// NOTE: calculateKPIsInternal MUST be declared before calculateKPIs.
// Both are `const` arrow functions (not hoisted), so declaration order matters.
// Rollup/Vite minifies this to a single-letter variable (e.g. `x`), and if
// calculateKPIs is evaluated first it will throw "Cannot access 'x' before initialization".
const calculateKPIsInternal = (data, history = null) => {
    // Strict parser that crashes on missing or invalid data per Fail Loudly doctrine
    const strictVal = (source, key) => {
        const rawValue = source[key];
        if (rawValue === undefined || rawValue === null) {
            throw new Error(`CRITICAL DATA MISSING: Required field '${key}' is missing from FDIC data.`);
        }
        const parsed = parseFloat(rawValue);
        if (isNaN(parsed)) {
            throw new Error(`CRITICAL DATA INVALID: Field '${key}' contains non-numeric value '${rawValue}'.`);
        }
        return parsed;
    };

    const val = (key) => strictVal(data, key);

    // #1 — Annualize YTD income fields. FDIC reports cumulative YTD income (NETINC, INTINC, etc.).
    // A Q1 report with 3 months of income divided by full-year assets yields ~4x understatement.
    // Multiply all flow-based income/expense by (12 / monthsElapsed) to annualize.
    const monthStr = String(data.REPDTE || '').substring(4, 6);
    const monthsMap = { '03': 3, '06': 6, '09': 9, '12': 12 };
    const monthsElapsed = monthsMap[monthStr] ?? 12;
    const annFactor = 12 / monthsElapsed; // 1.0 for Q4, 4/3 for Q3, 2.0 for Q2, 4.0 for Q1

    const nonInterestExp = val('NONIX');
    const nonInterestInc = val('NONII');
    const getInterestExp = () => {
        if ('INTEXP' in data && data.INTEXP !== null) return val('INTEXP');
        if ('EINTEXP' in data && data.EINTEXP !== null) return val('EINTEXP');
        throw new Error("CRITICAL DATA MISSING: Both 'INTEXP' and 'EINTEXP' are missing from FDIC data.");
    };
    const interestExp = getInterestExp();
    const interestExpAnn = interestExp * annFactor;         // for Cost of Funds & NIM
    const netInterestIncome = (val('INTINC') - interestExp) * annFactor; // annualized NIM base
    const interestIncomeAnn = val('INTINC') * annFactor;   // for Yield on Loans
    const totalAssets = val('ASSET');
    const totalIncome = netInterestIncome + nonInterestInc * annFactor; // annualized revenue base
    const totalLoans = val('LNLSNET');
    const numEmployees = val('NUMEMP');

    // 1. Efficiency Ratio
    let efficiencyRatio = 0;
    if (totalIncome > 0) {
        efficiencyRatio = (nonInterestExp / totalIncome) * 100;
    }

    // 2. Cost of Funds (annualized)
    let costOfFunds = 0;
    if (totalAssets > 0) {
        costOfFunds = (interestExpAnn / totalAssets) * 100;
    }

    // 3. Non-Interest Income % (ratio — no annualization needed; both sides are YTD flows)
    let nonInterestIncomePercent = 0;
    if (totalIncome > 0) {
        nonInterestIncomePercent = ((nonInterestInc * annFactor) / totalIncome) * 100;
    }

    // 4. Yield on Loans (annualized)
    let yieldOnLoans = 0;
    if (totalLoans > 0) {
        yieldOnLoans = (interestIncomeAnn / totalLoans) * 100;
    }

    // 5. Net Interest Margin (NIM) — already annualized via netInterestIncome above
    let netInterestMargin = 0;
    if (totalAssets > 0) {
        netInterestMargin = (netInterestIncome / totalAssets) * 100;
    }

    // 6. Assets per Employee ($M)
    // totalAssets is in thousands. totalAssets / 1000 = totalAssets in Millions
    let assetsPerEmployee = 0;
    if (numEmployees > 0) {
        assetsPerEmployee = (totalAssets / 1000) / numEmployees;
    }

    // 7. Return on Equity (ROE) — annualized
    let returnOnEquity = 0;
    const netIncome = val('NETINC');
    const netIncomeAnn = netIncome * annFactor;
    const totalEquity = val('EQ');
    if (totalEquity > 0) {
        returnOnEquity = (netIncomeAnn / totalEquity) * 100;
    }

    // 8. Return on Assets (ROA) — annualized
    let returnOnAssets = 0;
    if (totalAssets > 0) {
        returnOnAssets = (netIncomeAnn / totalAssets) * 100;
    }

    // 9. Non-Performing Loans (NPL) Ratio
    let nptlRatio = 0;
    const nonCurrentLoans = val('NCLNLS');
    if (totalLoans > 0) {
        nptlRatio = (nonCurrentLoans / totalLoans) * 100;
    }

    // 10. 3-Year Growth Metrics (CAGR)
    let assetGrowth3Y = null;
    let loanGrowth3Y = null;
    let depositGrowth3Y = null;
    let annualGrowthHistory = null;

    if (history && history.length >= 13) {
        const hVal = (record, key) => strictVal(record, key);
        const latest = history[0];
        const oneYearAgo = history[4];
        // #2 — Cap lookback to available history to avoid wrong-baseline bug
        const threeYearIdx = Math.min(12, history.length - 1);
        const twoYearAgo = history[Math.min(8, history.length - 1)];
        const threeYearAgo = history[threeYearIdx];
        if (threeYearIdx < 12) {
            console.warn(`kpiCalculator: only ${history.length} quarters available — 3Y CAGR uses ${threeYearIdx}q lookback instead of 12.`);
        }

        // Overall 3Y CAGR — plain numbers, formatted at render time
        assetGrowth3Y = calcCAGR(hVal(latest, 'ASSET'), hVal(threeYearAgo, 'ASSET'));
        loanGrowth3Y = calcCAGR(hVal(latest, 'LNLSNET'), hVal(threeYearAgo, 'LNLSNET'));
        depositGrowth3Y = calcCAGR(hVal(latest, 'DEP'), hVal(threeYearAgo, 'DEP'));

        // Annual YoY Points (Historical story for Sparkline)
        const calcYoY = (currRec, prevRec, key) => {
            const c = hVal(currRec, key);
            const p = hVal(prevRec, key);
            if (p <= 0 || c <= 0) return 0;
            return ((c / p) - 1) * 100;
        };

        // Returned in the result object — not mutating the input data
        annualGrowthHistory = {
            assetGrowth3Y: [
                calcYoY(latest, oneYearAgo, 'ASSET'),
                calcYoY(oneYearAgo, twoYearAgo, 'ASSET'),
                calcYoY(twoYearAgo, threeYearAgo, 'ASSET')
            ],
            loanGrowth3Y: [
                calcYoY(latest, oneYearAgo, 'LNLSNET'),
                calcYoY(oneYearAgo, twoYearAgo, 'LNLSNET'),
                calcYoY(twoYearAgo, threeYearAgo, 'LNLSNET')
            ],
            depositGrowth3Y: [
                calcYoY(latest, oneYearAgo, 'DEP'),
                calcYoY(oneYearAgo, twoYearAgo, 'DEP'),
                calcYoY(twoYearAgo, threeYearAgo, 'DEP')
            ]
        };
    }

    return {
        reportDate: formatQuarter(data.REPDTE),
        // All KPI values are plain numbers — format with .toFixed() only at render time.
        // Flow-based metrics (ROA, ROE, NIM, CoF, YoL) are annualized. (#1)
        efficiencyRatio,
        costOfFunds,
        nonInterestIncomePercent,
        yieldOnLoans,
        netInterestMargin,
        assetsPerEmployee,
        returnOnEquity,
        returnOnAssets,
        nptlRatio,
        assetGrowth3Y,
        loanGrowth3Y,
        depositGrowth3Y,
        annualGrowthHistory,
        raw: {
            ...data,
            netInterestIncome // annualized
        }
    };
};

export const calculateKPIs = (data) => {
    if (!data) return null;

    // Handle array of historical data
    // If it's an array, we calculate KPIs for each item.
    // However, to calculate growth metrics (3Y), we need the context of the whole array.
    if (Array.isArray(data)) {
        // We map and pass the full array as second argument to help calculation if needed
        return data.map((item, index, array) => {
            // Pass the slice from current index to enable rolling 3Y metrics
            return calculateKPIsInternal(item, array.slice(index));
        });
    }

    return calculateKPIsInternal(data);
};
