/**
 * Canonical configuration for the 6 core financial KPI gauges.
 * Used by FinancialDashboard and PitchbookPresentation — update min/max here only.
 *
 * Fields:
 *   key      — matches the KPI key returned by kpiCalculator.js
 *   label    — display label for the gauge
 *   min/max  — visual range bounds
 *   inverse  — true means lower is better (e.g. Efficiency Ratio, NPL Ratio)
 *   suffix   — unit suffix (default: "%")
 */
export const CORE_FINANCIAL_GAUGES = [
    { key: 'returnOnEquity', label: 'Return on Equity', min: 0, max: 25, metric: 'returnOnEquity' },
    { key: 'returnOnAssets', label: 'Return on Assets', min: 0, max: 2.5, metric: 'returnOnAssets' },
    { key: 'efficiencyRatio', label: 'Efficiency Ratio', min: 30, max: 90, inverse: true, metric: 'efficiencyRatio' },
    { key: 'netInterestMargin', label: 'Net Interest Margin', min: 0, max: 6, metric: 'netInterestMargin' },
    { key: 'assetGrowth3Y', label: 'Asset Growth (3Y)', min: -10, max: 30, suffix: '%', metric: 'assetGrowth3Y' },
    { key: 'nptlRatio', label: 'NPL Ratio', min: 0, max: 5, inverse: true, metric: 'nptlRatio' },
];
