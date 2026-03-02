import React, { useState } from 'react';
import GaugeChart from './GaugeChart';
import PeerGroupModal from './PeerGroupModal';
import SummaryModal from './SummaryModal';
import { exportDashboardToPDF } from '../utils/pdfExport';
import PrintContainer from './pdf/PrintContainer';
import { CORE_FINANCIAL_GAUGES } from '../utils/gaugeConfigs';

const FinancialDashboard = ({ financials, benchmarks, authRequired = true, isPresentMode, setIsPresentMode, secondaryBank, setSecondaryBank, secondaryFinancials, loadingSecondary }) => {

    const [isPeerModalOpen, setIsPeerModalOpen] = useState(false);
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportError, setExportError] = useState(null);
    const [aiSummary, setAiSummary] = useState('');

    const handlePresentLiveToggled = () => {
        setIsPresentMode(!isPresentMode);
    };

    const handleExportPDF = async () => {
        setIsExporting(true);
        setExportError(null);
        try {
            // Give React a tiny tick to ensure loaders show up
            await new Promise(resolve => setTimeout(resolve, 50));

            // Base slides that are always present
            const slidesToCapture = ['pdf-slide-1', 'pdf-slide-2'];

            // Add optional slides if data is present
            if (aiSummary) slidesToCapture.push('pdf-slide-3');
            if (benchmarks?.peerBanks?.length > 0) slidesToCapture.push('pdf-slide-4');

            // Trigger capture of the hidden 16:9 slides
            await exportDashboardToPDF(slidesToCapture, `BankValue_${financials.raw?.NAME || 'Report'}.pdf`);
        } catch (error) {
            console.error("Failed to export PDF:", error);
            setExportError("PDF export failed. Please try again.");
        } finally {
            setIsExporting(false);
        }
    };

    if (!financials) return null;

    // Note: kpiCalculator returns strings. ParseFloat needed.
    return (
        <div id="dashboard-export-zone" className="space-y-8 overflow-x-hidden w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0 shrink-0">
                    <h2 className="font-extrabold text-white tracking-tight text-2xl break-words">
                        Financial Health Scorecard
                    </h2>
                    <button
                        onClick={() => setIsSummaryModalOpen(true)}
                        className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-full text-sm font-bold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-300" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                        </svg>
                        AI Summarize
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0 min-w-0 overflow-x-auto">
                    <div className="flex border border-slate-700/50 rounded-full overflow-hidden shadow-sm hover:shadow-md transition-all hover:border-slate-500 bg-slate-800/50 backdrop-blur-md items-center p-1">
                        <button
                            onClick={handlePresentLiveToggled}
                            className="flex items-center justify-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold bg-blue-900/40 text-blue-300 hover:bg-blue-800/60 transition-all whitespace-nowrap active:scale-95"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 stroke-current" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span>Present Live</span>
                        </button>
                        <div className="w-px h-5 bg-slate-700 mx-1"></div>
                        <button
                            onClick={handleExportPDF}
                            disabled={isExporting}
                            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap active:scale-95 ${isExporting
                                ? 'text-slate-600 cursor-not-allowed'
                                : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                                }`}
                            title="Export PDF"
                        >
                            {isExporting ? (
                                <div className="w-3 h-3 rounded-full border-2 border-slate-400 border-t-transparent animate-spin"></div>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 stroke-current" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            )}
                            <span>PDF</span>
                        </button>
                    </div>
                    {exportError && (
                        <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-lg animate-in fade-in duration-200">
                            ⚠ {exportError}
                        </span>
                    )}

                    {benchmarks && benchmarks.groupName && (
                        <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50 shrink-0">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Benchmark:</span>
                            <span className="text-sm font-bold text-slate-300">{benchmarks.groupName}</span>
                            {benchmarks.sampleSize && (
                                <button
                                    onClick={() => setIsPeerModalOpen(true)}
                                    className="badge-premium ml-2"
                                    title="View Peer Group List"
                                >
                                    N={benchmarks.sampleSize}
                                </button>
                            )}
                        </div>
                    )}

                    {benchmarks && benchmarks.peerBanks && !isPresentMode && secondaryBank && (
                        <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50 shrink-0">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Compare:</span>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-purple-400 max-w-[200px] truncate" title={secondaryBank.NAME || secondaryBank.name}>
                                    {secondaryBank.NAME || secondaryBank.name}
                                </span>
                                <button
                                    onClick={() => setSecondaryBank(null)}
                                    className="text-slate-500 hover:text-red-400 transition-colors p-0.5 rounded-full hover:bg-slate-700/50"
                                    title="Clear comparison"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}
                    {/* Removed Data as of FDIC badge from here, relocated to App.jsx bank header */}
                </div>
            </div>

            {/* Peer Group Details Modal */}
            <PeerGroupModal
                isOpen={isPeerModalOpen}
                onClose={() => setIsPeerModalOpen(false)}
                title={`Peer Group: ${benchmarks?.groupName}`}
                banks={benchmarks?.peerBanks}
                subjectState={financials?.raw?.STALP}
                onBankSelect={(bank) => {
                    if (setSecondaryBank) {
                        setSecondaryBank({
                            CERT: bank.cert || bank.CERT,
                            NAME: bank.name || bank.NAME,
                            CITY: bank.city || bank.CITY,
                            STNAME: bank.state || bank.STNAME,
                            STALP: bank.stalp || bank.STALP,
                        });
                    }
                    setIsPeerModalOpen(false);
                }}
            />

            {/* AI Summary Modal */}
            <SummaryModal
                isOpen={isSummaryModalOpen}
                onClose={() => setIsSummaryModalOpen(false)}
                financials={financials}
                benchmarks={benchmarks}
                authRequired={authRequired}
                onSummaryGenerated={setAiSummary}
            />


            {/* Growth Performance (New) */}
            <div className="glass-panel-dark group animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                {/* Glowing Left Border Accent */}
                <div className="absolute top-0 left-0 w-1.5 h-full rounded-l-xl bg-gradient-to-b from-purple-500 via-indigo-500 to-blue-500 shadow-[2px_0_15px_rgba(99,102,241,0.5)]"></div>

                <h3 className="text-xl font-extrabold text-white mb-4 flex items-center gap-2 px-2 tracking-wide">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5V2a1 1 0 112 0v5a1 1 0 01-1 1h-5z" clipRule="evenodd" />
                        <path d="M2.293 12.293a1 1 0 011.414 0L11 4.586 15.586 9H13a1 1 0 110-2h5v5a1 1 0 11-2 0V9.414l-5.293 5.293a1 1 0 01-1.414 0L6 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L5.293 10 9 13.707l5.586-5.586L13 9.414V11a1 1 0 11-2 0v-5a1 1 0 011-1h5a1 1 0 110 2h-2.586l4.293 4.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0L6 11.414l-3.707 3.707a1 1 0 01-1.414-1.414l4.414-4.414L2.293 12.293z" />
                    </svg>
                    3-Year Growth Performance (CAGR)
                </h3>
                <div className="flex h-[1px] w-full bg-slate-800/80 mb-8"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 justify-items-center">
                    <GaugeChart
                        label="Asset Growth (3Y)"
                        value={financials.assetGrowth3Y != null ? parseFloat(financials.assetGrowth3Y) : null}
                        secondaryValue={secondaryFinancials?.assetGrowth3Y != null ? parseFloat(secondaryFinancials.assetGrowth3Y) : null}
                        min={-10}
                        max={30}
                        average={benchmarks && benchmarks.assetGrowth3Y != null ? parseFloat(benchmarks.assetGrowth3Y) : null}
                        p25={benchmarks && benchmarks.p25 ? benchmarks.p25.assetGrowth3Y : null}
                        p75={benchmarks && benchmarks.p75 ? benchmarks.p75.assetGrowth3Y : null}
                        suffix="%"
                        trend={financials.history}
                        metric="assetGrowth3Y"
                    />
                    <GaugeChart
                        label="Loan Growth (3Y)"
                        value={financials.loanGrowth3Y != null ? parseFloat(financials.loanGrowth3Y) : null}
                        secondaryValue={secondaryFinancials?.loanGrowth3Y != null ? parseFloat(secondaryFinancials.loanGrowth3Y) : null}
                        min={-10}
                        max={30}
                        average={benchmarks && benchmarks.loanGrowth3Y != null ? parseFloat(benchmarks.loanGrowth3Y) : null}
                        p25={benchmarks && benchmarks.p25 ? benchmarks.p25.loanGrowth3Y : null}
                        p75={benchmarks && benchmarks.p75 ? benchmarks.p75.loanGrowth3Y : null}
                        suffix="%"
                        trend={financials.history}
                        metric="loanGrowth3Y"
                    />
                    <GaugeChart
                        label="Deposit Growth (3Y)"
                        value={financials.depositGrowth3Y != null ? parseFloat(financials.depositGrowth3Y) : null}
                        secondaryValue={secondaryFinancials?.depositGrowth3Y != null ? parseFloat(secondaryFinancials.depositGrowth3Y) : null}
                        min={-10}
                        max={30}
                        average={benchmarks && benchmarks.depositGrowth3Y != null ? parseFloat(benchmarks.depositGrowth3Y) : null}
                        p25={benchmarks && benchmarks.p25 ? benchmarks.p25.depositGrowth3Y : null}
                        p75={benchmarks && benchmarks.p75 ? benchmarks.p75.depositGrowth3Y : null}
                        suffix="%"
                        trend={financials.history}
                        metric="depositGrowth3Y"
                    />
                </div>
            </div>

            {/* Operational Efficiency & Margin */}
            <div className="glass-panel-dark group animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                <div className="absolute top-0 left-0 w-1.5 h-full rounded-l-xl bg-gradient-to-b from-purple-500 via-indigo-500 to-blue-500 shadow-[2px_0_15px_rgba(99,102,241,0.5)]"></div>
                <h3 className="text-xl font-extrabold text-white mb-4 flex items-center gap-2 px-2 tracking-wide">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                    Operational Efficiency & Margin
                </h3>
                <div className="flex h-[1px] w-full bg-slate-800/80 mb-8"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 justify-items-center">
                    <GaugeChart
                        label="Efficiency Ratio"
                        value={parseFloat(financials.efficiencyRatio)}
                        secondaryValue={secondaryFinancials ? parseFloat(secondaryFinancials.efficiencyRatio) : null}
                        min={30}
                        max={90}
                        average={benchmarks ? parseFloat(benchmarks.efficiencyRatio) : null}
                        p25={benchmarks?.p25?.efficiencyRatio}
                        p75={benchmarks?.p75?.efficiencyRatio}
                        inverse={true}
                        trend={financials.history}
                        metric="efficiencyRatio"
                    />
                    <GaugeChart
                        label="Net Interest Margin"
                        value={parseFloat(financials.netInterestMargin)}
                        secondaryValue={secondaryFinancials ? parseFloat(secondaryFinancials.netInterestMargin) : null}
                        min={0}
                        max={6}
                        average={benchmarks ? parseFloat(benchmarks.netInterestMargin) : null}
                        p25={benchmarks?.p25?.netInterestMargin}
                        p75={benchmarks?.p75?.netInterestMargin}
                        trend={financials.history}
                        metric="netInterestMargin"
                    />
                    <GaugeChart
                        label="Cost of Funds"
                        value={parseFloat(financials.costOfFunds)}
                        secondaryValue={secondaryFinancials ? parseFloat(secondaryFinancials.costOfFunds) : null}
                        min={0}
                        max={5}
                        average={benchmarks ? parseFloat(benchmarks.costOfFunds) : null}
                        p25={benchmarks?.p25?.costOfFunds}
                        p75={benchmarks?.p75?.costOfFunds}
                        inverse={true}
                        trend={financials.history}
                        metric="costOfFunds"
                    />
                </div>
            </div>

            {/* Revenue Generation & Productivity */}
            <div className="glass-panel-dark group animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                <div className="absolute top-0 left-0 w-1.5 h-full rounded-l-xl bg-gradient-to-b from-purple-500 via-indigo-500 to-blue-500 shadow-[2px_0_15px_rgba(99,102,241,0.5)]"></div>
                <h3 className="text-xl font-extrabold text-white mb-4 flex items-center gap-2 px-2 tracking-wide">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                    </svg>
                    Revenue Generation & Productivity
                </h3>
                <div className="flex h-[1px] w-full bg-slate-800/80 mb-8"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 justify-items-center">
                    <GaugeChart
                        label="Non-Interest Income"
                        value={parseFloat(financials.nonInterestIncomePercent)}
                        secondaryValue={secondaryFinancials ? parseFloat(secondaryFinancials.nonInterestIncomePercent) : null}
                        min={0}
                        max={40}
                        average={benchmarks ? parseFloat(benchmarks.nonInterestIncomePercent) : null}
                        p25={benchmarks?.p25?.nonInterestIncomePercent}
                        p75={benchmarks?.p75?.nonInterestIncomePercent}
                        trend={financials.history}
                        metric="nonInterestIncomePercent"
                    />
                    <GaugeChart
                        label="Yield on Loans"
                        value={parseFloat(financials.yieldOnLoans)}
                        secondaryValue={secondaryFinancials ? parseFloat(secondaryFinancials.yieldOnLoans) : null}
                        min={2}
                        max={10}
                        average={benchmarks ? parseFloat(benchmarks.yieldOnLoans) : null}
                        p25={benchmarks?.p25?.yieldOnLoans}
                        p75={benchmarks?.p75?.yieldOnLoans}
                        trend={financials.history}
                        metric="yieldOnLoans"
                    />
                    <GaugeChart
                        label="Assets / Employee ($M)"
                        value={parseFloat(financials.assetsPerEmployee)}
                        secondaryValue={secondaryFinancials?.assetsPerEmployee != null ? parseFloat(secondaryFinancials.assetsPerEmployee) : null}
                        min={0}
                        max={25}
                        average={benchmarks?.assetsPerEmployee ? parseFloat(benchmarks.assetsPerEmployee) : null}
                        p25={benchmarks?.p25?.assetsPerEmployee ? parseFloat(benchmarks.p25.assetsPerEmployee) : undefined}
                        p75={benchmarks?.p75?.assetsPerEmployee ? parseFloat(benchmarks.p75.assetsPerEmployee) : undefined}
                        suffix="M"
                        trend={financials.history}
                        metric="assetsPerEmployee"
                    />
                </div>
            </div>

            {/* Returns & Asset Quality */}
            <div className="glass-panel-dark group animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                <div className="absolute top-0 left-0 w-1.5 h-full rounded-l-xl bg-gradient-to-b from-purple-500 via-indigo-500 to-blue-500 shadow-[2px_0_15px_rgba(99,102,241,0.5)]"></div>
                <h3 className="text-xl font-extrabold text-white mb-4 flex items-center gap-2 px-2 tracking-wide">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Returns &amp; Asset Quality
                </h3>
                <div className="flex h-[1px] w-full bg-slate-800/80 mb-8"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 justify-items-center">
                    {CORE_FINANCIAL_GAUGES
                        .filter(g => ['returnOnEquity', 'returnOnAssets', 'nptlRatio'].includes(g.key))
                        .map(cfg => (
                            <GaugeChart
                                key={cfg.key}
                                label={cfg.label}
                                value={parseFloat(financials[cfg.key])}
                                secondaryValue={secondaryFinancials ? parseFloat(secondaryFinancials[cfg.key]) : null}
                                min={cfg.min}
                                max={cfg.max}
                                average={benchmarks ? parseFloat(benchmarks[cfg.key]) : null}
                                p25={benchmarks?.p25?.[cfg.key]}
                                p75={benchmarks?.p75?.[cfg.key]}
                                inverse={cfg.inverse || false}
                                suffix={cfg.suffix || '%'}
                                trend={financials.history}
                                metric={cfg.metric}
                            />
                        ))
                    }
                </div>
            </div>

            {/* Hidden PDF Export Slides */}
            <PrintContainer financials={financials} benchmarks={benchmarks} aiSummary={aiSummary} />
        </div>
    );
};

export default FinancialDashboard;
