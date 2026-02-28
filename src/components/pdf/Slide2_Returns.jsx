import React from 'react';
import PresentationSlide from './PresentationSlide';
import GaugeChart from '../GaugeChart';

const Slide2_Returns = ({ financials, benchmarks, bankName }) => {
    return (
        <PresentationSlide title="Revenue & Returns" bankName={bankName} id="pdf-slide-2">
            <div className="flex-1 flex flex-col gap-16" id="pdf-slide-2">
                {/* Revenue Generation & Productivity */}
                <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm flex-1">
                    <h3 className="text-3xl font-bold text-blue-900 mb-12 flex items-center gap-4">
                        <svg className="h-10 w-10 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                        </svg>
                        Revenue Generation & Productivity
                    </h3>
                    <div className="grid grid-cols-3 gap-16 justify-items-center scale-125 origin-top mt-12">
                        <GaugeChart
                            label="Non-Interest Income"
                            value={parseFloat(financials.nonInterestIncomePercent)}
                            min={0} max={40}
                            average={benchmarks ? parseFloat(benchmarks.nonInterestIncomePercent) : null}
                            trend={financials.history} metric="nonInterestIncomePercent"
                        />
                        <GaugeChart
                            label="Yield on Loans"
                            value={parseFloat(financials.yieldOnLoans)}
                            min={2} max={10}
                            average={benchmarks ? parseFloat(benchmarks.yieldOnLoans) : null}
                            trend={financials.history} metric="yieldOnLoans"
                        />
                        <GaugeChart
                            label="Assets / Employee ($M)"
                            value={(parseFloat(financials.assetsPerEmployee) / 1000000).toFixed(1)}
                            min={0} max={25} suffix="M"
                            average={benchmarks?.assetsPerEmployee ? (parseFloat(benchmarks.assetsPerEmployee) / 1000000).toFixed(1) : null}
                            trend={financials.history} metric="assetsPerEmployee"
                        />
                    </div>
                </div>

                {/* Returns & Asset Quality */}
                <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm flex-1">
                    <h3 className="text-3xl font-bold text-blue-900 mb-12 flex items-center gap-4">
                        <svg className="h-10 w-10 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Returns & Asset Quality
                    </h3>
                    <div className="grid grid-cols-3 gap-16 justify-items-center scale-125 origin-top mt-12">
                        <GaugeChart
                            label="Return on Equity"
                            value={parseFloat(financials.returnOnEquity)}
                            min={0} max={25}
                            average={benchmarks ? parseFloat(benchmarks.returnOnEquity) : null}
                            trend={financials.history} metric="returnOnEquity"
                        />
                        <GaugeChart
                            label="Return on Assets"
                            value={parseFloat(financials.returnOnAssets)}
                            min={0} max={2.5}
                            average={benchmarks ? parseFloat(benchmarks.returnOnAssets) : null}
                            trend={financials.history} metric="returnOnAssets"
                        />
                        <GaugeChart
                            label="NPL Ratio"
                            value={parseFloat(financials.nptlRatio)}
                            min={0} max={5} inverse={true}
                            average={benchmarks ? parseFloat(benchmarks.nptlRatio) : null}
                            trend={financials.history} metric="nptlRatio"
                        />
                    </div>
                </div>
            </div>
        </PresentationSlide>
    );
};

export default Slide2_Returns;
