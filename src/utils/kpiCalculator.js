/**
 * Calculate Financial KPIs from raw FDIC Call Report data.
 * @param {Object} data - The raw data object from the API (ASSET, INTEXP, etc.)
 * @returns {Object} - An object containing formatted KPI values.
 */
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

const calculateKPIsInternal = (data, history = null) => {
    // Helper to parse string numbers to float, default to 0
    const val = (key) => parseFloat(data[key]) || 0;

    const nonInterestExp = val('NONIX');
    const nonInterestInc = val('NONII');
    const interestExp = val('INTEXP') || val('EINTEXP');
    const netInterestIncome = val('INTINC') - interestExp; // Calculated NIM
    const totalAssets = val('ASSET'); // In thousands? FDIC usually reports in thousands.
    const totalIncome = netInterestIncome + nonInterestInc;
    const totalLoans = val('LNLSNET');
    const interestIncome = val('INTINC');
    const numEmployees = val('NUMEMP');

    // 1. Efficiency Ratio
    let efficiencyRatio = 0;
    if (totalIncome > 0) {
        efficiencyRatio = (nonInterestExp / totalIncome) * 100;
    }

    // 2. Cost of Funds
    let costOfFunds = 0;
    if (totalAssets > 0) {
        costOfFunds = (interestExp / totalAssets) * 100;
    }

    // 3. Non-Interest Income %
    let nonInterestIncomePercent = 0;
    if (totalIncome > 0) {
        nonInterestIncomePercent = (nonInterestInc / totalIncome) * 100;
    }

    // 4. Yield on Loans
    let yieldOnLoans = 0;
    if (totalLoans > 0) {
        yieldOnLoans = (interestIncome / totalLoans) * 100;
    }

    // 5. Net Interest Margin (NIM)
    let netInterestMargin = 0;
    if (totalAssets > 0) {
        netInterestMargin = (netInterestIncome / totalAssets) * 100;
    }

    // 6. Assets per Employee
    let assetsPerEmployee = 0;
    if (numEmployees > 0) {
        assetsPerEmployee = (totalAssets * 1000) / numEmployees;
    }

    // 7. Return on Equity (ROE)
    let returnOnEquity = 0;
    const netIncome = val('NETINC');
    const totalEquity = val('EQ');
    if (totalEquity > 0) {
        returnOnEquity = (netIncome / totalEquity) * 100;
    }

    // 8. Return on Assets (ROA)
    let returnOnAssets = 0;
    if (totalAssets > 0) {
        returnOnAssets = (netIncome / totalAssets) * 100;
    }

    // 9. Non-Performing Loans (NPL) Ratio
    let nonPerformingLoansRatio = 0;
    const nonCurrentLoans = val('NCLNLS');
    if (totalLoans > 0) {
        nonPerformingLoansRatio = (nonCurrentLoans / totalLoans) * 100;
    }

    // 10. 3-Year Growth Metrics (CAGR)
    let assetGrowth3Y = null;
    let loanGrowth3Y = null;
    let depositGrowth3Y = null;

    if (history && history.length >= 13) {
        const hVal = (record, key) => parseFloat(record[key]) || 0;
        const latest = history[0];
        const oneYearAgo = history[4];
        const twoYearAgo = history[8];
        const threeYearAgo = history[12];

        // Overall 3Y CAGR (Gauge Value)
        const calcCAGR = (curr, prev) => {
            const c = hVal(latest, curr);
            const p = hVal(threeYearAgo, prev);
            if (p <= 0 || c <= 0) return 0;
            return (Math.pow(c / p, 1 / 3) - 1) * 100;
        };

        assetGrowth3Y = calcCAGR('ASSET', 'ASSET').toFixed(2);
        loanGrowth3Y = calcCAGR('LNLSNET', 'LNLSNET').toFixed(2);
        depositGrowth3Y = calcCAGR('DEP', 'DEP').toFixed(2);

        // Annual YoY Points (Historical story for Sparkline)
        // Note: For trendlines to work, we attach these to the latest object 
        // using the existing metric names so TrendIndicator can find them if needed,
        // OR we can create specialized historical points.
        // Let's create annual YoY points: Year 1 (latest vs 1Y ago), Year 2 (1Y ago vs 2Y ago), Year 3 (2Y ago vs 3Y ago)
        const calcYoY = (currRec, prevRec, key) => {
            const c = hVal(currRec, key);
            const p = hVal(prevRec, key);
            if (p <= 0 || c <= 0) return 0;
            return ((c / p) - 1) * 100;
        };

        // Attach specialized history points for the trend component
        data.annualGrowthHistory = {
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
        efficiencyRatio: efficiencyRatio.toFixed(2),
        costOfFunds: costOfFunds.toFixed(2),
        nonInterestIncomePercent: nonInterestIncomePercent.toFixed(2),
        yieldOnLoans: yieldOnLoans.toFixed(2),
        netInterestMargin: netInterestMargin.toFixed(2),
        assetsPerEmployee: assetsPerEmployee.toFixed(0),
        returnOnEquity: returnOnEquity.toFixed(2),
        returnOnAssets: returnOnAssets.toFixed(2),
        nptlRatio: nonPerformingLoansRatio.toFixed(2),
        assetGrowth3Y,
        loanGrowth3Y,
        depositGrowth3Y,
        raw: {
            ...data,
            netInterestIncome
        }
    };
};
