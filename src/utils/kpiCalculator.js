/**
 * Calculate Financial KPIs from raw FDIC Call Report data.
 * @param {Object} data - The raw data object from the API (ASSET, INTEXP, etc.)
 * @returns {Object} - An object containing formatted KPI values.
 */
export const calculateKPIs = (data) => {
    if (!data) return null;

    // Helper to parse string numbers to float, default to 0
    const val = (key) => parseFloat(data[key]) || 0;

    const nonInterestExp = val('NONIX');
    const nonInterestInc = val('NONII');
    const interestExp = val('INTEXP') || val('EINTEXP');
    const netInterestIncome = val('INTINC') - interestExp; // Calculated NIM
    const totalAssets = val('ASSET'); // In thousands? FDIC usually reports in thousands.
    const totalIncome = netInterestIncome + nonInterestInc;
    const totalLoans = val('LNLSNET');
    const interestIncome = val('INTINC'); // Roughly using Total Int Inc as proxy if Loan-specific missing
    const numEmployees = val('NUMEMP');

    // 1. Efficiency Ratio: Non-Int Exp / (Net Int Inc + Non-Int Inc)
    // Formula: NONIX / ( (INTINC - INTEXP) + NONII )
    let efficiencyRatio = 0;
    if (totalIncome > 0) {
        efficiencyRatio = (nonInterestExp / totalIncome) * 100;
    }

    // 2. Cost of Funds: Interest Exp / Average Assets
    // We use Total Assets as proxy for Avg Assets
    let costOfFunds = 0;
    if (totalAssets > 0) {
        costOfFunds = (interestExp / totalAssets) * 100;
    }

    // 3. Non-Interest Income %: Non-Int Inc / Total Income
    // Formula: NONII / ( (INTINC - INTEXP) + NONII )
    let nonInterestIncomePercent = 0;
    if (totalIncome > 0) {
        nonInterestIncomePercent = (nonInterestInc / totalIncome) * 100;
    }

    // 4. Yield on Loans: Interest Income on Loans / Total Loans
    // We are temporarily using Total Interest Income / Total Loans 
    // This is an OVER-ESTIMATE (Yield on Earning Assets).
    // But it's better than 0. Ideally we find the `INTINCL` field.
    let yieldOnLoans = 0;
    if (totalLoans > 0) {
        yieldOnLoans = (interestIncome / totalLoans) * 100;
    }

    // 5. Net Interest Margin (NIM): Net Int Inc / Total Assets
    // A key profitability metric.
    let netInterestMargin = 0;
    if (totalAssets > 0) {
        netInterestMargin = (netInterestIncome / totalAssets) * 100;
    }

    // 6. Assets per Employee: Total Assets / Num Employees
    // Result in Millions usually, but let's keep raw thousands first.
    // FDIC ASSET is in Thousands ($000).
    // So if ASSET=1,000,000 ($1B), Employees=100 -> 10,000 ($10M).
    let assetsPerEmployee = 0;
    if (numEmployees > 0) {
        // Convert Assets (thousands) to actual dollars? 
        // Or Keep as "Thousands per Employee"? 
        // Let's display e.g. "$10.5M".
        // (ASSET * 1000) / NUMEMP
        assetsPerEmployee = (totalAssets * 1000) / numEmployees;
    }


    // 7. Return on Equity (ROE): Net Income / Total Equity Capital
    // Formula: NETINC / EQ
    let returnOnEquity = 0;
    const netIncome = val('NETINC');
    const totalEquity = val('EQ');
    if (totalEquity > 0) {
        returnOnEquity = (netIncome / totalEquity) * 100;
    }

    // 8. Return on Assets (ROA): Net Income / Total Assets
    // Formula: NETINC / ASSET
    let returnOnAssets = 0;
    if (totalAssets > 0) {
        returnOnAssets = (netIncome / totalAssets) * 100;
    }

    // 9. Non-Performing Loans (NPL) Ratio: Noncurrent Loans / Net Loans
    // Formula: NCLNLS / LNLSNET
    // Note: NCLNLS = Loans past due 90+ days + Nonaccrual
    let nonPerformingLoansRatio = 0;
    const nonCurrentLoans = val('NCLNLS');
    if (totalLoans > 0) {
        nonPerformingLoansRatio = (nonCurrentLoans / totalLoans) * 100;
    }

    return {
        efficiencyRatio: efficiencyRatio.toFixed(2),
        costOfFunds: costOfFunds.toFixed(2),
        nonInterestIncomePercent: nonInterestIncomePercent.toFixed(2),
        yieldOnLoans: yieldOnLoans.toFixed(2),
        netInterestMargin: netInterestMargin.toFixed(2),
        assetsPerEmployee: assetsPerEmployee.toFixed(0), // Raw dollars
        returnOnEquity: returnOnEquity.toFixed(2),
        returnOnAssets: returnOnAssets.toFixed(2),
        nonPerformingLoansRatio: nonPerformingLoansRatio.toFixed(2),
        raw: {
            ...data,
            netInterestIncome
        }
    };
};


