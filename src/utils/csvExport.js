/**
 * csvExport.js
 * Generates and triggers a browser CSV download from KPI + benchmark data.
 * All values are formatted to 2 decimal places. No external dependencies.
 */

/**
 * Convert a flat object of KPI values into quoted CSV rows.
 * @param {string} bankName - Primary bank display name
 * @param {object} financials - Computed KPI object from kpiCalculator
 * @param {object|null} benchmarks - Peer benchmark object (averages, groupName, etc.)
 * @param {string} quarter - Current selected quarter label (e.g. "Q4 2025")
 */
export function exportKPIsToCSV(bankName, financials, benchmarks, quarter) {
    if (!financials) throw new Error('exportKPIsToCSV: financials is required');

    const fmt = (val) => (val != null && val !== '' ? parseFloat(val).toFixed(2) : 'N/A');

    // ── Rows ────────────────────────────────────────────────────────────────────
    const rows = [
        // Header
        ['Metric', 'Value', 'Peer Avg', 'P25', 'P75', 'Unit'],

        // Growth
        ['Asset Growth (3Y CAGR)', fmt(financials.assetGrowth3Y), fmt(benchmarks?.assetGrowth3Y), fmt(benchmarks?.p25?.assetGrowth3Y), fmt(benchmarks?.p75?.assetGrowth3Y), '%'],
        ['Loan Growth (3Y CAGR)', fmt(financials.loanGrowth3Y), fmt(benchmarks?.loanGrowth3Y), fmt(benchmarks?.p25?.loanGrowth3Y), fmt(benchmarks?.p75?.loanGrowth3Y), '%'],
        ['Deposit Growth (3Y CAGR)', fmt(financials.depositGrowth3Y), fmt(benchmarks?.depositGrowth3Y), fmt(benchmarks?.p25?.depositGrowth3Y), fmt(benchmarks?.p75?.depositGrowth3Y), '%'],

        // Profitability
        ['Return on Assets (ROA)', fmt(financials.roa), fmt(benchmarks?.roa), fmt(benchmarks?.p25?.roa), fmt(benchmarks?.p75?.roa), '%'],
        ['Return on Equity (ROE)', fmt(financials.roe), fmt(benchmarks?.roe), fmt(benchmarks?.p25?.roe), fmt(benchmarks?.p75?.roe), '%'],
        ['Net Interest Margin (NIM)', fmt(financials.nim), fmt(benchmarks?.nim), fmt(benchmarks?.p25?.nim), fmt(benchmarks?.p75?.nim), '%'],

        // Efficiency
        ['Efficiency Ratio', fmt(financials.efficiencyRatio), fmt(benchmarks?.efficiencyRatio), fmt(benchmarks?.p25?.efficiencyRatio), fmt(benchmarks?.p75?.efficiencyRatio), '%'],

        // Credit Quality
        ['Non-Performing Assets / Total Assets', fmt(financials.npa), fmt(benchmarks?.npa), fmt(benchmarks?.p25?.npa), fmt(benchmarks?.p75?.npa), '%'],
        ['Net Charge-Off Rate', fmt(financials.ncoRate), fmt(benchmarks?.ncoRate), fmt(benchmarks?.p25?.ncoRate), fmt(benchmarks?.p75?.ncoRate), '%'],

        // Capital
        ['Tier 1 Leverage Ratio', fmt(financials.tier1Leverage), fmt(benchmarks?.tier1Leverage), fmt(benchmarks?.p25?.tier1Leverage), fmt(benchmarks?.p75?.tier1Leverage), '%'],
        ['Total Risk-Based Capital Ratio', fmt(financials.totalCapitalRatio), fmt(benchmarks?.totalCapitalRatio), fmt(benchmarks?.p25?.totalCapitalRatio), fmt(benchmarks?.p75?.totalCapitalRatio), '%'],

        // Liquidity
        ['Loan-to-Deposit Ratio', fmt(financials.ldr), fmt(benchmarks?.ldr), fmt(benchmarks?.p25?.ldr), fmt(benchmarks?.p75?.ldr), '%'],
    ];

    // ── Metadata header block ───────────────────────────────────────────────────
    const meta = [
        ['BankValue — KPI Export'],
        ['Bank', bankName],
        ['Period', quarter || 'Latest'],
        ['Peer Group', benchmarks?.groupName || 'N/A'],
        ['Peer Count', benchmarks?.sampleSize || 'N/A'],
        ['Exported', new Date().toLocaleString()],
        [], // blank divider
    ];

    const allRows = [...meta, ...rows];

    // ── Escape & join ───────────────────────────────────────────────────────────
    const csv = allRows
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    // ── Trigger download ────────────────────────────────────────────────────────
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BankValue_${bankName.replace(/[^a-z0-9]/gi, '_')}_${quarter || 'Latest'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
