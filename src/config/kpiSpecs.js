export const KPI_SPECS = [
    { key: "asset_growth_3y", label: "3Y Asset Growth (CAGR)", better: "higher", type: "rate", metric_class: "derived" },
    { key: "loan_growth_3y", label: "3Y Loan Growth (CAGR)", better: "higher", type: "rate", metric_class: "derived" },
    { key: "deposit_growth_3y", label: "3Y Deposit Growth (CAGR)", better: "higher", type: "rate", metric_class: "derived" },
    { key: "eff_ratio", label: "Efficiency Ratio", better: "lower", type: "rate", metric_class: "core", base_key: "raw_revenue" },
    { key: "nim", label: "Net Interest Margin (NIM)", better: "higher", type: "rate", metric_class: "core", base_key: "raw_assets" },
    { key: "cost_of_funds", label: "Cost of Funds", better: "lower", type: "rate", metric_class: "core", base_key: "raw_deposits" },
    { key: "non_int_income_pct", label: "Non-Interest Income %", better: "higher", type: "rate", metric_class: "core", base_key: "raw_revenue" },
    { key: "loan_yield", label: "Yield on Loans", better: "higher", type: "rate", metric_class: "core", base_key: "raw_loans" },
    { key: "assets_per_employee", label: "Assets per Employee", better: "higher", type: "scalar", metric_class: "denominator-sensitive" },
    { key: "roe", label: "Return on Equity (ROE)", better: "higher", type: "rate", metric_class: "core", base_key: "raw_equity" },
    { key: "roa", label: "Return on Assets (ROA)", better: "higher", type: "rate", metric_class: "core", base_key: "raw_assets" },
    { key: "npl_ratio", label: "NPL Ratio", better: "lower", type: "rate", metric_class: "core", base_key: "raw_loans" },
];

export const SNAPSHOT_KPIS = [
    { key: "nim", label: "NIM", better: "higher", fmt: (v) => `${(v * 100).toFixed(2)}%` },
    { key: "cost_of_funds", label: "Cost of Funds", better: "lower", fmt: (v) => `${(v * 100).toFixed(2)}%` },
    { key: "eff_ratio", label: "Efficiency Ratio", better: "lower", fmt: (v) => `${(v * 100).toFixed(1)}%` },
    { key: "npl_ratio", label: "NPL Ratio", better: "lower", fmt: (v) => `${(v * 100).toFixed(2)}%` },
    { key: "roa", label: "ROA", better: "higher", fmt: (v) => `${(v * 100).toFixed(2)}%` },
    { key: "non_int_income_pct", label: "Non-Int Income %", better: "higher", fmt: (v) => `${(v * 100).toFixed(1)}%` },
];

export function fmtSigned(x, digits = 2) {
    const sign = x >= 0 ? "+" : "";
    return `${sign}${x.toFixed(digits)}`;
}
