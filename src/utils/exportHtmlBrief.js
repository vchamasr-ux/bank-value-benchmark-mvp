

export const generateHtmlBriefString = (financials, benchmarks, aiSummary) => {
    // Fail loudly if no financials are loaded
    if (!financials || !benchmarks) {
        throw new Error("Cannot export brief: Core financial data is missing.");
    }

    const reportDate = financials?.reportDate;
    const name = financials?.raw?.NAME || financials?.name || 'Bank';
    const assetSize = financials?.raw?.ASSET || financials?.assetSize || 0;
    const peerGroupName = benchmarks?.groupName || "Peer Group";

    // Format large numbers
    const formatB = (num) => `$${(num / 1000000).toFixed(2)}B`;

    // Helper to format KPI values safely
    const formatVal = (val, isPercent = true) => {
        if (val === null || val === undefined || isNaN(val)) return 'N/A';
        return isPercent ? `${val.toFixed(2)}%` : val.toFixed(2);
    };

    // Helper to format Delta (positive is green unless inverted)
    const formatDelta = (val, inverted = false) => {
        if (val === null || val === undefined || isNaN(val)) return `<span class="text-slate-400">N/A</span>`;
        const isPositive = val > 0;
        const isGood = inverted ? !isPositive : isPositive;
        const color = isGood ? 'text-emerald-600' : 'text-red-600';
        const sign = isPositive ? '+' : '';
        return `<span class="font-bold ${color}">${sign}${val.toFixed(2)}%</span>`;
    };

    // Core KPIs to display
    const coreMetrics = [
        { label: 'Return on Assets (ROA)', key: 'returnOnAssets', inv: false },
        { label: 'Return on Equity (ROE)', key: 'returnOnEquity', inv: false },
        { label: 'Net Interest Margin (NIM)', key: 'netInterestMargin', inv: false },
        { label: 'Efficiency Ratio', key: 'efficiencyRatio', inv: true },
        { label: 'Non-Interest Income %', key: 'nonInterestIncomePercent', inv: false },
        { label: 'NPL Ratio', key: 'nptlRatio', inv: true },
        { label: 'Yield on Loans', key: 'yieldOnLoans', inv: false },
        { label: 'Cost of Funds', key: 'costOfFunds', inv: true }
    ];

    // Generate Table Rows
    let tableRows = '';
    coreMetrics.forEach(metric => {
        const bankVal = parseFloat(financials[metric.key]);
        const peerAvg = benchmarks ? parseFloat(benchmarks[metric.key]) : undefined;
        const delta = (bankVal !== undefined && peerAvg !== undefined && !isNaN(bankVal) && !isNaN(peerAvg))
            ? bankVal - peerAvg
            : null;

        tableRows += `
            <tr class="border-b border-slate-200 hover:bg-slate-50">
                <td class="py-3 px-4 text-sm font-medium text-slate-800">${metric.label}</td>
                <td class="py-3 px-4 text-sm font-bold text-blue-900 text-right">${formatVal(bankVal)}</td>
                <td class="py-3 px-4 text-sm text-slate-600 text-right">${formatVal(peerAvg)}</td>
                <td class="py-3 px-4 text-sm text-right">${formatDelta(delta, metric.inv)}</td>
            </tr>
        `;
    });

    // Format AI Summary Content (convert simple markdown to HTML if needed, or just wrap in styled div)
    // We assume aiSummary.summary is plain text with markdown bold ** and bullets *
    let formattedSummary = '<p class="text-slate-500 italic">No AI summary generated for this session.</p>';
    if (aiSummary && aiSummary.summary) {
        // Simple regex replace for markdown bold and bullets to HTML
        let htmlContent = aiSummary.summary
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n\*\s(.*?)/g, '<li class="ml-4 list-disc">$1</li>')
            .replace(/\n/g, '<br/>');

        formattedSummary = `
            <div contenteditable="true" class="prose prose-blue max-w-none text-slate-700 leading-relaxed outline-none focus:ring-2 focus:ring-blue-100 rounded p-2 transition-all">
                ${htmlContent}
            </div>
        `;
    }

    const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${name} - Executive Brief</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f8fafc;
            padding: 2rem;
            color: #0f172a;
        }
        .page-container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            padding: 3rem;
            border-radius: 1rem;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        }
        @media print {
            body { background: white; padding: 0; }
            .page-container { box-shadow: none; padding: 0; max-width: 100%; border-radius: 0; }
            .no-print { display: none !important; }
        }
    </style>
</head>
<body>
    <div class="page-container">
        <!-- Header -->
        <header class="border-b-4 border-blue-900 pb-6 mb-8 flex justify-between items-end">
            <div>
                <h1 class="text-4xl font-black text-blue-900 mb-2" contenteditable="true">${name}</h1>
                <h2 class="text-xl text-slate-500 font-medium" contenteditable="true">Strategic Financial Brief</h2>
            </div>
            <div class="text-right">
                <div class="text-sm font-bold tracking-widest text-slate-400 uppercase mb-1">Total Assets</div>
                <div class="text-2xl font-bold text-slate-800">${formatB(assetSize)}</div>
                <div class="text-xs text-slate-500 mt-1">As-of: ${reportDate || 'Unknown'}</div>
            </div>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-12">
            
            <!-- Main Content (Left Col) -->
            <div class="lg:col-span-2">
                <!-- AI Strategy Section -->
                <section class="mb-10">
                    <div class="flex items-center gap-2 mb-4">
                        <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        <h3 class="text-xl font-bold text-slate-800" contenteditable="true">Executive AI Synthesis</h3>
                    </div>
                    <div class="bg-indigo-50/50 border border-indigo-100 rounded-xl p-6">
                        ${formattedSummary}
                        <div class="mt-4 text-[10px] text-indigo-400 uppercase tracking-wider font-bold no-print text-right">
                            Click text to edit before presenting
                        </div>
                    </div>
                </section>

                <!-- Core KPI Table -->
                <section>
                    <h3 class="text-xl font-bold text-slate-800 mb-4" contenteditable="true">Financial Scorecard vs. ${peerGroupName}</h3>
                    <div class="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-slate-100">
                                    <th class="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Metric</th>
                                    <th class="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">${name}</th>
                                    <th class="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">Peer Avg</th>
                                    <th class="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">Delta</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white">
                                ${tableRows}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            <!-- Sidebar (Right Col) -->
            <div class="lg:col-span-1">
                <div class="bg-slate-50 rounded-xl p-6 border border-slate-200 h-full">
                    <h4 class="font-bold text-slate-800 mb-2 border-b border-slate-200 pb-2">Report Details</h4>
                    <div class="text-xs text-slate-600 space-y-3">
                        <div>
                            <span class="font-bold block text-slate-400 uppercase">Benchmark Group</span>
                            <span contenteditable="true">${peerGroupName}</span>
                        </div>
                        <div>
                            <span class="font-bold block text-slate-400 uppercase">Sample Size</span>
                            <span>${benchmarks.sampleSize || 'N/A'} Institutions</span>
                        </div>
                        <div>
                            <span class="font-bold block text-slate-400 uppercase">Analysis Date</span>
                            <span>${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        </div>
                    </div>

                    <div class="mt-8 pt-6 border-t border-slate-200">
                        <h4 class="font-bold text-slate-800 mb-2">Executive Notes</h4>
                        <div contenteditable="true" class="text-sm text-slate-600 italic min-h-[150px] outline-none focus:ring-2 focus:ring-blue-100 rounded p-2" placeholder="Add confidential board notes here...">
                            [Click to add custom board notes...]
                        </div>
                    </div>
                </div>
            </div>

        </div>

        <!-- Footer -->

        </footer>
    </div>
</body>
</html>
    `;

    return htmlTemplate;
};
