import React, { useState, useEffect } from 'react';
import GaugeChart from './GaugeChart';
import PeerGroupModal from './PeerGroupModal';
import SummaryModal from './SummaryModal';
import { exportDashboardToPDF } from '../utils/pdfExport';

const FinancialDashboard = ({ financials, benchmarks, authRequired = true, isPresentMode, setIsPresentMode }) => {
    const [isPeerModalOpen, setIsPeerModalOpen] = useState(false);
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Listen for native Fullscreen exits (e.g., ESC key)
    useEffect(() => {
        const handleFullscreenChange = () => {
            if (!document.fullscreenElement && isPresentMode) {
                setIsPresentMode(false);
            }
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, [isPresentMode, setIsPresentMode]);

    const handlePresentLiveToggled = async () => {
        try {
            if (!isPresentMode) {
                await document.documentElement.requestFullscreen();
                setIsPresentMode(true);
            } else {
                if (document.fullscreenElement) {
                    await document.exitFullscreen();
                }
                setIsPresentMode(false);
            }
        } catch (err) {
            console.error("Fullscreen toggle failed", err);
            // Fallback: just toggle the CSS state if native fullscreen fails
            setIsPresentMode(!isPresentMode);
        }
    };

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            // Give React a tiny tick to ensure loaders show up
            await new Promise(resolve => setTimeout(resolve, 50));
            await exportDashboardToPDF('dashboard-export-zone', `BankValue_${financials.raw?.NAME || 'Report'}.pdf`);
        } catch (error) {
            console.error("Failed to export PDF:", error);
            alert("Error generating PDF. Please check the console.");
        } finally {
            setIsExporting(false);
        }
    };

    if (!financials) return null;

    // Note: kpiCalculator returns strings. ParseFloat needed.
    return (
        <div id="dashboard-export-zone" className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <h2 className={`font-black text-blue-900 tracking-tight ${isPresentMode ? 'text-4xl' : 'text-2xl'}`}>
                        Financial Health Scorecard
                    </h2>
                    {!isPresentMode && (
                        <button
                            onClick={() => setIsSummaryModalOpen(true)}
                            className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-full text-sm font-bold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-300" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                            </svg>
                            AI Summarize
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    {!isPresentMode && (
                        <div className="flex border border-slate-200 rounded-full overflow-hidden shadow-sm hover:shadow-md transition-all hover:border-blue-300 bg-white items-center p-1">
                            <button
                                onClick={handlePresentLiveToggled}
                                className="flex items-center justify-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all whitespace-nowrap active:scale-95"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 stroke-current" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                <span>Present Live</span>
                            </button>
                            <div className="w-px h-5 bg-slate-200 mx-1"></div>
                            <button
                                onClick={handleExportPDF}
                                disabled={isExporting}
                                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap active:scale-95 ${isExporting
                                    ? 'text-slate-400 cursor-not-allowed'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'
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
                    )}

                    {benchmarks && benchmarks.groupName && (
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Benchmark:</span>
                            <span className="text-sm font-bold text-slate-600">{benchmarks.groupName}</span>
                            {benchmarks.sampleSize && (
                                <button
                                    onClick={() => !isPresentMode && setIsPeerModalOpen(true)}
                                    className={`text-blue-600 font-bold ml-1 bg-blue-100/50 px-2 py-0.5 rounded text-xs transition-colors ${!isPresentMode ? 'hover:text-blue-800 cursor-pointer' : 'cursor-default'}`}
                                    title="View Peer Group List"
                                >
                                    N={benchmarks.sampleSize}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {isPresentMode && (
                <button
                    onClick={handlePresentLiveToggled}
                    className="fixed bottom-8 right-8 z-[200] bg-slate-900 border border-slate-700 text-white shadow-2xl rounded-full px-6 py-3 font-bold flex items-center gap-2 hover:bg-slate-800 hover:scale-105 transition-all outline-none"
                    title="Exit Presentation Mode (Esc)"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Exit Presentation
                </button>
            )}

            {/* Peer Group Details Modal */}
            <PeerGroupModal
                isOpen={isPeerModalOpen}
                onClose={() => setIsPeerModalOpen(false)}
                title={`Peer Group: ${benchmarks?.groupName}`}
                banks={benchmarks?.peerBanks || []}
                subjectState={financials?.raw?.STALP}
            />

            {/* AI Summary Modal */}
            <SummaryModal
                isOpen={isSummaryModalOpen}
                onClose={() => setIsSummaryModalOpen(false)}
                financials={financials}
                benchmarks={benchmarks}
                authRequired={authRequired}
            />

            {/* Geographic Distribution Map */}


            {/* Growth Performance (New) */}
            <div className="bg-blue-900/5 p-6 rounded-xl border border-blue-100 mb-8">
                <h3 className="text-lg font-bold text-blue-900 mb-6 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5V2a1 1 0 112 0v5a1 1 0 01-1 1h-5z" clipRule="evenodd" />
                        <path d="M2.293 12.293a1 1 0 011.414 0L11 4.586 15.586 9H13a1 1 0 110-2h5v5a1 1 0 11-2 0V9.414l-5.293 5.293a1 1 0 01-1.414 0L6 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L5.293 10 9 13.707l5.586-5.586L13 9.414V11a1 1 0 11-2 0v-5a1 1 0 011-1h5a1 1 0 110 2h-2.586l4.293 4.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0L6 11.414l-3.707 3.707a1 1 0 01-1.414-1.414l4.414-4.414L2.293 12.293z" />
                    </svg>
                    3-Year Growth Performance (CAGR)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 justify-items-center">
                    <GaugeChart
                        label="Asset Growth (3Y)"
                        value={parseFloat(financials.assetGrowth3Y) || 0}
                        min={-10}
                        max={30}
                        average={benchmarks ? parseFloat(benchmarks.assetGrowth3Y) : null}
                        p25={benchmarks ? benchmarks.p25.assetGrowth3Y : null}
                        p75={benchmarks ? benchmarks.p75.assetGrowth3Y : null}
                        suffix="%"
                        trend={financials.history}
                        metric="assetGrowth3Y"
                    />
                    <GaugeChart
                        label="Loan Growth (3Y)"
                        value={parseFloat(financials.loanGrowth3Y) || 0}
                        min={-10}
                        max={30}
                        average={benchmarks ? parseFloat(benchmarks.loanGrowth3Y) : null}
                        p25={benchmarks ? benchmarks.p25.loanGrowth3Y : null}
                        p75={benchmarks ? benchmarks.p75.loanGrowth3Y : null}
                        suffix="%"
                        trend={financials.history}
                        metric="loanGrowth3Y"
                    />
                    <GaugeChart
                        label="Deposit Growth (3Y)"
                        value={parseFloat(financials.depositGrowth3Y) || 0}
                        min={-10}
                        max={30}
                        average={benchmarks ? parseFloat(benchmarks.depositGrowth3Y) : null}
                        p25={benchmarks ? benchmarks.p25.depositGrowth3Y : null}
                        p75={benchmarks ? benchmarks.p75.depositGrowth3Y : null}
                        suffix="%"
                        trend={financials.history}
                        metric="depositGrowth3Y"
                    />
                </div>
            </div>

            {/* Operational Efficiency & Margin */}
            <div className="bg-blue-900/5 p-6 rounded-xl border border-blue-100 mb-8">
                <h3 className="text-lg font-bold text-blue-900 mb-6 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                    Operational Efficiency & Margin
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 justify-items-center">
                    <GaugeChart
                        label="Efficiency Ratio"
                        value={parseFloat(financials.efficiencyRatio)}
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
            <div className="bg-blue-900/5 p-6 rounded-xl border border-blue-100 mb-8">
                <h3 className="text-lg font-bold text-blue-900 mb-6 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                    </svg>
                    Revenue Generation & Productivity
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 justify-items-center">
                    <GaugeChart
                        label="Non-Interest Income"
                        value={parseFloat(financials.nonInterestIncomePercent)}
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
                        value={(parseFloat(financials.assetsPerEmployee) / 1000000).toFixed(1)}
                        min={0}
                        max={25}
                        average={benchmarks?.assetsPerEmployee ? (parseFloat(benchmarks.assetsPerEmployee) / 1000000).toFixed(1) : null}
                        p25={benchmarks?.p25?.assetsPerEmployee ? (parseFloat(benchmarks.p25.assetsPerEmployee) / 1000000).toFixed(1) : undefined}
                        p75={benchmarks?.p75?.assetsPerEmployee ? (parseFloat(benchmarks.p75.assetsPerEmployee) / 1000000).toFixed(1) : undefined}
                        suffix="M"
                        trend={financials.history}
                        metric="assetsPerEmployee"
                    />
                </div>
            </div>

            {/* Returns & Asset Quality */}
            <div className="bg-blue-900/5 p-6 rounded-xl border border-blue-100">
                <h3 className="text-lg font-bold text-blue-900 mb-6 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Returns & Asset Quality
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 justify-items-center">
                    <GaugeChart
                        label="Return on Equity"
                        value={parseFloat(financials.returnOnEquity)}
                        min={0}
                        max={25}
                        average={benchmarks ? parseFloat(benchmarks.returnOnEquity) : null}
                        p25={benchmarks?.p25?.returnOnEquity}
                        p75={benchmarks?.p75?.returnOnEquity}
                        trend={financials.history}
                        metric="returnOnEquity"
                    />
                    <GaugeChart
                        label="Return on Assets"
                        value={parseFloat(financials.returnOnAssets)}
                        min={0}
                        max={2.5}
                        average={benchmarks ? parseFloat(benchmarks.returnOnAssets) : null}
                        p25={benchmarks?.p25?.returnOnAssets}
                        p75={benchmarks?.p75?.returnOnAssets}
                        trend={financials.history}
                        metric="returnOnAssets"
                    />
                    <GaugeChart
                        label="NPL Ratio"
                        value={parseFloat(financials.nptlRatio)}
                        min={0}
                        max={5}
                        average={benchmarks ? parseFloat(benchmarks.nptlRatio) : null}
                        p25={benchmarks?.p25?.nptlRatio}
                        p75={benchmarks?.p75?.nptlRatio}
                        inverse={true}
                        trend={financials.history}
                        metric="nptlRatio"
                    />
                </div>
            </div>
        </div>
    );
};

export default FinancialDashboard;
