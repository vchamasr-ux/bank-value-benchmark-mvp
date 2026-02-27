import React, { useState } from 'react';
import GaugeChart from './GaugeChart';
import PeerGroupModal from './PeerGroupModal';
import SummaryModal from './SummaryModal';

const FinancialDashboard = ({ financials, benchmarks, authRequired = true }) => {
    const [isPeerModalOpen, setIsPeerModalOpen] = useState(false);
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

    if (!financials) return null;

    // Note: kpiCalculator returns strings. ParseFloat needed.
    const getAvg = (key, fallback) => benchmarks ? parseFloat(benchmarks[key]) : fallback;
    const getAvgAssets = () => benchmarks ? (parseFloat(benchmarks.assetsPerEmployee) / 1000000).toFixed(1) : 10;

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <h2 className="text-2xl font-black text-blue-900 tracking-tight">
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

                {benchmarks && benchmarks.groupName && (
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Benchmark:</span>
                        <span className="text-sm font-bold text-slate-600">{benchmarks.groupName}</span>
                        {benchmarks.sampleSize && (
                            <button
                                onClick={() => setIsPeerModalOpen(true)}
                                className="text-blue-600 hover:text-blue-800 font-bold ml-1 bg-blue-100/50 px-2 py-0.5 rounded text-xs transition-colors"
                                title="View Peer Group List"
                            >
                                N={benchmarks.sampleSize}
                            </button>
                        )}
                    </div>
                )}
            </div>

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
                        average={benchmarks ? parseFloat(benchmarks.assetGrowth3Y) : 8.5}
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
                        average={benchmarks ? parseFloat(benchmarks.loanGrowth3Y) : 7.2}
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
                        average={benchmarks ? parseFloat(benchmarks.depositGrowth3Y) : 6.8}
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
                        average={getAvg('efficiencyRatio', 60)}
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
                        average={getAvg('netInterestMargin', 3.5)}
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
                        average={getAvg('costOfFunds', 2.5)}
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
                        average={getAvg('nonInterestIncomePercent', 20)}
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
                        average={getAvg('yieldOnLoans', 6)}
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
                        average={getAvgAssets()}
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
                        average={getAvg('returnOnEquity', 12)}
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
                        average={getAvg('returnOnAssets', 1.1)}
                        p25={benchmarks?.p25?.returnOnAssets}
                        p75={benchmarks?.p75?.returnOnAssets}
                        trend={financials.history}
                        metric="returnOnAssets"
                    />
                    <GaugeChart
                        label="NPL Ratio"
                        value={parseFloat(financials.nonPerformingLoansRatio)}
                        min={0}
                        max={5}
                        average={getAvg('nonPerformingLoansRatio', 0.75)}
                        p25={benchmarks?.p25?.nonPerformingLoansRatio}
                        p75={benchmarks?.p75?.nonPerformingLoansRatio}
                        inverse={true}
                        trend={financials.history}
                        metric="nonPerformingLoansRatio"
                    />
                </div>
            </div>
        </div>
    );
};

export default FinancialDashboard;
