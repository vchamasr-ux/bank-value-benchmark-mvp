import React, { useState } from 'react';
import GaugeChart from './GaugeChart';
import PeerGroupModal from './PeerGroupModal';

const FinancialDashboard = ({ financials, benchmarks }) => {
    const [isPeerModalOpen, setIsPeerModalOpen] = useState(false);

    if (!financials) return null;

    // Use dynamic benchmarks if available, otherwise fallback
    const avgs = benchmarks || {
        efficiencyRatio: 60,
        costOfFunds: 2.5,
        nonInterestIncomePercent: 20,
        yieldOnLoans: 6,
        assetsPerEmployee: 10000000 // Raw dollars for calculation logic? No, kpiCalculator returns strings/fixed.
    };

    // Note: kpiCalculator returns strings. ParseFloat needed.
    const getAvg = (key, fallback) => benchmarks ? parseFloat(benchmarks[key]) : fallback;
    const getAvgAssets = () => benchmarks ? (parseFloat(benchmarks.assetsPerEmployee) / 1000000).toFixed(1) : 10;

    const peerGroupLabel = benchmarks && benchmarks.groupName ? `Avg (${benchmarks.groupName})` : 'Avg (Peer Group)';

    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-bold text-blue-900 border-b pb-2 flex items-baseline justify-between">
                <span>Financial Health Scorecard</span>
                {benchmarks && benchmarks.groupName && (
                    <span className="text-sm font-normal text-gray-500 ml-4">
                        Benchmark: {benchmarks.groupName}{' '}
                        {benchmarks.sampleSize ? (
                            <button
                                onClick={() => setIsPeerModalOpen(true)}
                                className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium ml-1 bg-blue-50 px-2 py-0.5 rounded transition-colors"
                                title="View Peer Group List"
                            >
                                (N={benchmarks.sampleSize})
                            </button>
                        ) : ''}
                    </span>
                )}
            </h2>

            {/* Peer Group Details Modal */}
            <PeerGroupModal
                isOpen={isPeerModalOpen}
                onClose={() => setIsPeerModalOpen(false)}
                title={`Peer Group: ${benchmarks?.groupName}`}
                banks={benchmarks?.peerBanks || []}
            />

            {/* Geographic Distribution Map */}


            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
                {/* 1. Efficiency Ratio (Lower is Better) */}
                <div className="flex flex-col items-center gap-2">
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
                </div>

                {/* 2. Net Interest Margin (Higher is Better) */}
                <div className="flex flex-col items-center gap-2">
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
                </div>

                {/* 3. Cost of Funds (Lower is Better) */}
                <div className="flex flex-col items-center gap-2">
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

                {/* 3. Non-Interest Income % (Higher is Better) */}
                <div className="flex flex-col items-center gap-2">
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
                </div>

                {/* 4. Yield on Loans (Higher is Better) */}
                <div className="flex flex-col items-center gap-2">
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
                </div>

                {/* 5. Assets per Employee (Higher is Better) */}
                <div className="flex flex-col items-center gap-2">
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

                {/* 6. Return on Equity (Higher is Better) */}
                <div className="flex flex-col items-center gap-2">
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
                </div>

                {/* 7. Return on Assets (Higher is Better) */}
                <div className="flex flex-col items-center gap-2">
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
                </div>

                {/* 8. NPL Ratio (Lower is Better) */}
                <div className="flex flex-col items-center gap-2">
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
