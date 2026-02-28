import React from 'react';
import PresentationSlide from './PresentationSlide';
import GaugeChart from '../GaugeChart';

const Slide1_CoreMetrics = ({ financials, benchmarks, bankName }) => {
    return (
        <PresentationSlide title="Core Financial Metrics" bankName={bankName} id="pdf-slide-1">
            <div className="flex-1 flex flex-col gap-16" id="pdf-slide-1">
                {/* 3-Year Growth Performance */}
                <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm flex-1">
                    <h3 className="text-3xl font-bold text-blue-900 mb-12 flex items-center gap-4">
                        <svg className="h-10 w-10 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5V2a1 1 0 112 0v5a1 1 0 01-1 1h-5z" clipRule="evenodd" />
                            <path d="M2.293 12.293a1 1 0 011.414 0L11 4.586 15.586 9H13a1 1 0 110-2h5v5a1 1 0 11-2 0V9.414l-5.293 5.293a1 1 0 01-1.414 0L6 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L5.293 10 9 13.707l5.586-5.586L13 9.414V11a1 1 0 11-2 0v-5a1 1 0 011-1h5a1 1 0 110 2h-2.586l4.293 4.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0L6 11.414l-3.707 3.707a1 1 0 01-1.414-1.414l4.414-4.414L2.293 12.293z" />
                        </svg>
                        3-Year Growth Performance (CAGR)
                    </h3>
                    <div className="grid grid-cols-3 gap-16 justify-items-center scale-125 origin-top mt-12">
                        <GaugeChart
                            label="Asset Growth"
                            value={parseFloat(financials.assetGrowth3Y) || 0}
                            min={-10} max={30}
                            average={benchmarks ? parseFloat(benchmarks.assetGrowth3Y) : null}
                            suffix="%" trend={financials.history} metric="assetGrowth3Y"
                        />
                        <GaugeChart
                            label="Loan Growth"
                            value={parseFloat(financials.loanGrowth3Y) || 0}
                            min={-10} max={30}
                            average={benchmarks ? parseFloat(benchmarks.loanGrowth3Y) : null}
                            suffix="%" trend={financials.history} metric="loanGrowth3Y"
                        />
                        <GaugeChart
                            label="Deposit Growth"
                            value={parseFloat(financials.depositGrowth3Y) || 0}
                            min={-10} max={30}
                            average={benchmarks ? parseFloat(benchmarks.depositGrowth3Y) : null}
                            suffix="%" trend={financials.history} metric="depositGrowth3Y"
                        />
                    </div>
                </div>

                {/* Operational Efficiency & Margin */}
                <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm flex-1">
                    <h3 className="text-3xl font-bold text-blue-900 mb-12 flex items-center gap-4">
                        <svg className="h-10 w-10 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                        </svg>
                        Operational Efficiency & Margin
                    </h3>
                    <div className="grid grid-cols-3 gap-16 justify-items-center scale-125 origin-top mt-12">
                        <GaugeChart
                            label="Efficiency Ratio"
                            value={parseFloat(financials.efficiencyRatio)}
                            min={30} max={90} inverse={true}
                            average={benchmarks ? parseFloat(benchmarks.efficiencyRatio) : null}
                            trend={financials.history} metric="efficiencyRatio"
                        />
                        <GaugeChart
                            label="Net Interest Margin"
                            value={parseFloat(financials.netInterestMargin)}
                            min={0} max={6}
                            average={benchmarks ? parseFloat(benchmarks.netInterestMargin) : null}
                            trend={financials.history} metric="netInterestMargin"
                        />
                        <GaugeChart
                            label="Cost of Funds"
                            value={parseFloat(financials.costOfFunds)}
                            min={0} max={5} inverse={true}
                            average={benchmarks ? parseFloat(benchmarks.costOfFunds) : null}
                            trend={financials.history} metric="costOfFunds"
                        />
                    </div>
                </div>
            </div>
        </PresentationSlide>
    );
};

export default Slide1_CoreMetrics;
