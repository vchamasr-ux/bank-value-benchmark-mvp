import React, { useState, useEffect } from 'react';
import GaugeChart from './GaugeChart';
import MoversView from './MoversView';
import StrategicPlannerTab from './StrategicPlannerTab';
import Sparkline from './Sparkline';

const PitchbookPresentation = ({
    selectedBank,
    financials,
    benchmarks,
    fdicService,
    onClose
}) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [aiSummaryHtml, setAiSummaryHtml] = useState(null);

    const getBenchmark = (key) => benchmarks ? parseFloat(benchmarks[key]) : 0;

    // Fetch AI summary from localStorage if available (since the user likely already generated it)
    // Or we just parse whatever is passed in if we lift state. For now, let's gracefully fail if not loaded.
    useEffect(() => {
        // As a quick hack for the prototype, we can check if the user had already generated a summary.
        // In a real production app, we would lift the AI summary state up to App.jsx.
        // But for this MVP, we can just grab it if it's there, or leave it blank.
        const cachedKey = `benchmark_summary_${financials.raw.CERT}`;
        const cached = localStorage.getItem(cachedKey);
        if (cached) {
            try {
                const data = JSON.parse(cached);
                if (data.markdown) {
                    setAiSummaryHtml(data.markdown);
                }
            } catch (e) {
                console.warn("Failed to parse cached summary");
            }
        }
    }, [financials.raw.CERT]);

    const getAiBullets = () => {
        let bullets = [];
        if (aiSummaryHtml) {
            // Very simple markdown list extraction for the prototype
            const lines = aiSummaryHtml.split('\n');
            bullets = lines
                .filter(line => line.trim().startsWith('* ') || line.trim().startsWith('- '))
                .map(line => line.replace(/^[*-\s]+/, '').trim().replace(/\*\*/g, ''))
                .slice(0, 3);

            // Fallback if the AI didn't use lists
            if (bullets.length === 0) {
                bullets = lines.filter(l => l.length > 50).slice(0, 3).map(l => l.replace(/\*\*/g, ''));
            }
        }

        // Final fallback if nothing found
        if (bullets.length === 0) {
            bullets = [
                `${selectedBank.NAME} holds $${(parseFloat(financials.raw.ASSET) / 1000000).toFixed(1)}B in total assets.`,
                `The bank operates with an Efficiency Ratio of ${parseFloat(financials.efficiencyRatio).toFixed(1)}% compared to the peer average of ${getBenchmark('efficiencyRatio').toFixed(1)}%.`,
                `Return on Average Assets (ROA) is tracking at ${parseFloat(financials.returnOnAssets).toFixed(2)}% against a benchmark of ${getBenchmark('returnOnAssets').toFixed(2)}%.`
            ];
        }
        return bullets;
    };

    const aiBullets = getAiBullets();

    const matchBulletToMetric = (bullet) => {
        const text = bullet.toLowerCase();
        if (text.includes('efficiency ratio') || text.includes('efficiency')) {
            return {
                metric: 'Efficiency Ratio',
                value: parseFloat(financials.efficiencyRatio),
                average: getBenchmark('efficiencyRatio'),
                min: 30, max: 90, inverse: true, suffix: '%'
            };
        }
        if (text.includes('return on assets') || text.includes('roa ')) {
            return {
                metric: 'Return on Assets',
                value: parseFloat(financials.returnOnAssets),
                average: getBenchmark('returnOnAssets'),
                min: 0, max: 2.5, inverse: false, suffix: '%'
            };
        }
        if (text.includes('return on equity') || text.includes('roe ')) {
            return {
                metric: 'Return on Equity',
                value: parseFloat(financials.returnOnEquity),
                average: getBenchmark('returnOnEquity'),
                min: 0, max: 25, inverse: false, suffix: '%'
            };
        }
        if (text.includes('net interest margin') || text.includes('nim')) {
            return {
                metric: 'Net Interest Margin',
                value: parseFloat(financials.netInterestMargin),
                average: getBenchmark('netInterestMargin'),
                min: 0, max: 6, inverse: false, suffix: '%'
            };
        }
        if (text.includes('asset') && text.includes('growth')) {
            return {
                metric: 'Asset Growth (3Y)',
                value: parseFloat(financials.assetGrowth3Y) || 0,
                average: getBenchmark('assetGrowth3Y'),
                min: -10, max: 30, inverse: false, suffix: '%'
            };
        }
        if (text.includes('npl') || text.includes('non-performing')) {
            return {
                metric: 'NPL Ratio',
                value: parseFloat(financials.nptlRatio) || 0,
                average: getBenchmark('nptlRatio'),
                min: 0, max: 5, inverse: true, suffix: '%'
            };
        }
        return null;
    };

    const slides = [
        {
            id: 'title',
            isCover: true,
            content: (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-8 animate-in fade-in zoom-in duration-700">
                    <div className="w-24 h-24 bg-blue-900 rounded-full flex items-center justify-center shadow-lg border-4 border-white mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-4xl md:text-6xl font-black text-slate-800 tracking-tight uppercase">
                            Executive Briefing
                        </h1>
                        <p className="text-xl md:text-2xl text-slate-500 font-bold mt-4 uppercase tracking-widest">
                            Performance Benchmarking Review
                        </p>
                    </div>
                    <div className="mt-8 flex items-center gap-6">
                        <span className="text-3xl font-bold text-blue-900">{selectedBank.NAME}</span>
                    </div>
                    <div className="mt-2 text-slate-500 font-medium">
                        {selectedBank.CITY}, {selectedBank.STNAME} • Cert: {selectedBank.CERT}
                    </div>
                    <div className="absolute bottom-16 w-full text-center">
                        <p className="text-slate-500 text-sm font-bold">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                </div>
            )
        },
        {
            id: 'insights',
            actionTitle: "Strategic Summary & Key Insights",
            actionSubtitle: "High-level performance assessment relative to regional peer institutions.",
            content: (
                <div className="w-full h-full flex items-center justify-center px-12">
                    <div className="w-full space-y-8">
                        {aiBullets.map((bullet, idx) => {
                            const matchedMetric = matchBulletToMetric(bullet);
                            return (
                                <div key={idx} className={`flex items-start gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both delay-${(idx + 1) * 200}`}>
                                    <div className="w-12 h-12 rounded-sm bg-blue-900 flex items-center justify-center flex-shrink-0 mt-1 shadow-md">
                                        <span className="text-white font-black text-xl">{idx + 1}</span>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-blue-900 mb-1 uppercase tracking-wide">Key Insight {idx + 1}</h3>
                                        <p className="text-lg text-slate-700 leading-relaxed font-medium">{bullet}</p>
                                        {matchedMetric && (
                                            <div className="mt-4 bg-slate-50 p-4 rounded border border-slate-200 inline-block w-full max-w-sm shadow-sm">
                                                <Sparkline
                                                    label={matchedMetric.metric}
                                                    value={matchedMetric.value}
                                                    average={matchedMetric.average}
                                                    min={matchedMetric.min}
                                                    max={matchedMetric.max}
                                                    inverse={matchedMetric.inverse}
                                                    suffix={matchedMetric.suffix}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )
        },
        {
            id: 'financial',
            actionTitle: `Core Financial Performance vs. ${benchmarks?.groupName || 'Peers'}`,
            actionSubtitle: "A distilled view of the most critical financial health and profitability indicators against the benchmark.",
            content: (
                <div className="w-full h-full flex flex-col justify-center px-8">
                    <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-3 gap-y-12 gap-x-8 justify-items-center content-center animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both">
                        <GaugeChart
                            label="Return on Equity"
                            value={parseFloat(financials.returnOnEquity)}
                            min={0}
                            max={25}
                            average={benchmarks ? parseFloat(benchmarks.returnOnEquity) : null}
                            p25={benchmarks?.p25?.returnOnEquity}
                            p75={benchmarks?.p75?.returnOnEquity}
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
                            metric="returnOnAssets"
                        />
                        <GaugeChart
                            label="Efficiency Ratio"
                            value={parseFloat(financials.efficiencyRatio)}
                            min={30}
                            max={90}
                            average={benchmarks ? parseFloat(benchmarks.efficiencyRatio) : null}
                            p25={benchmarks?.p25?.efficiencyRatio}
                            p75={benchmarks?.p75?.efficiencyRatio}
                            inverse={true}
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
                            metric="netInterestMargin"
                        />
                        <GaugeChart
                            label="Asset Growth (3Y)"
                            value={parseFloat(financials.assetGrowth3Y) || 0}
                            min={-10}
                            max={30}
                            average={benchmarks ? parseFloat(benchmarks.assetGrowth3Y) : null}
                            p25={benchmarks ? benchmarks.p25.assetGrowth3Y : null}
                            p75={benchmarks ? benchmarks.p75.assetGrowth3Y : null}
                            suffix="%"
                            metric="assetGrowth3Y"
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
                            metric="nptlRatio"
                        />
                    </div>
                </div>
            )
        },
        {
            id: 'radar',
            actionTitle: "Market Positioning & Peer Distribution",
            actionSubtitle: "Visualizing the bank's position amongst its direct competitors in the benchmark group.",
            content: (
                <div className="w-full h-[100%] relative border border-slate-200 rounded p-4 bg-slate-50 shadow-inner overflow-y-auto animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 fill-mode-both">
                    <div className="scale-[0.98] origin-top">
                        {/* Re-use the MoversView but specifically in 'Scatter' block mode natively */}
                        <MoversView
                            dataProvider={fdicService}
                            perspectiveBankName={selectedBank.NAME}
                            focusBankCert={String(selectedBank.CERT)}
                            segmentKey={benchmarks?.assetFilter || 'ASSET:[50000000 TO 250000000]'}
                            segmentLabel={benchmarks?.groupName || 'Peer Group'}
                            priorQuarter="Q3 2025"
                            currentQuarter="Q4 2025"
                            onDrillDown={() => { }} // Disable drilldown in presentation mode
                            onShowBrief={() => { }}
                            isPresentationMode={true} // New prop to limit rows and hide unnecessary UI
                        />
                    </div>
                </div>
            )
        },
        {
            id: 'planner',
            actionTitle: "Forward-Looking Strategy & Rate Shock",
            actionSubtitle: "Modeling the theoretical impact of interest rate movements on Net Interest Margin and baseline profitability.",
            content: (
                <div className="w-full h-[100%] border border-slate-200 rounded p-4 bg-slate-50 shadow-inner overflow-y-auto animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 fill-mode-both">
                    {/* Note: We force overflow-y-auto ALONE here because Strategic Planner is tall */}
                    <div className="scale-90 origin-top">
                        <StrategicPlannerTab
                            financials={financials}
                            benchmarks={benchmarks}
                        />
                    </div>
                </div>
            )
        }
    ];

    const handleNext = () => {
        if (currentSlide < slides.length - 1) setCurrentSlide(currentSlide + 1);
    };

    const handlePrev = () => {
        if (currentSlide > 0) setCurrentSlide(currentSlide - 1);
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight' || e.key === 'Space') handleNext();
            else if (e.key === 'ArrowLeft') handlePrev();
            else if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentSlide, onClose]);

    const activeSlide = slides[currentSlide];

    return (
        <div className="fixed inset-0 z-[200] bg-[#e2e8f0] flex flex-col items-center justify-center font-sans">
            {/* Top Navigation Frame (Outside the slide canvas) */}
            <div className="absolute top-0 w-full flex items-center justify-between p-4 bg-slate-800 text-white shadow-md z-10">
                <button
                    onClick={onClose}
                    className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider bg-white/10 hover:bg-white/20 px-4 py-2 rounded outline-none"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Close Presentation
                </button>
                <div className="absolute left-1/2 transform -translate-x-1/2 text-slate-400 text-xs font-bold tracking-widest uppercase flex items-center gap-2">
                    <span>Slide {currentSlide + 1} of {slides.length}</span>
                    <span className="opacity-50">•</span>
                    <span>Use &larr; &rarr; to navigate</span>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handlePrev}
                        disabled={currentSlide === 0}
                        className={`px-4 py-1.5 rounded text-sm font-bold transition-colors outline-none ${currentSlide === 0 ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
                    >
                        Prev
                    </button>
                    <button
                        onClick={handleNext}
                        disabled={currentSlide === slides.length - 1}
                        className={`px-4 py-1.5 rounded text-sm font-bold transition-colors outline-none ${currentSlide === slides.length - 1 ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'}`}
                    >
                        Next
                    </button>
                </div>
            </div>

            {/* Formal 16:9 IB Slide Canvas */}
            <div
                className="bg-white shadow-2xl relative flex flex-col overflow-hidden"
                style={{
                    width: '95vw',
                    maxWidth: '1600px',
                    aspectRatio: '16/9',
                    maxHeight: '90vh' // Ensure it doesn't overflow vertically on small screens
                }}
            >
                {!activeSlide.isCover && (
                    <div className="w-full px-10 pt-8 pb-4 border-b-2 border-slate-800 flex justify-between items-end flex-shrink-0 animate-in fade-in duration-300">
                        <div className="max-w-4xl">
                            <h2 className="text-3xl font-black text-blue-900 tracking-tight leading-tight">
                                {activeSlide.actionTitle}
                            </h2>
                            {activeSlide.actionSubtitle && (
                                <p className="text-slate-500 font-medium text-lg mt-1 tracking-wide">
                                    {activeSlide.actionSubtitle}
                                </p>
                            )}
                        </div>
                        <div className="text-right">
                            <div className="text-lg font-black text-slate-300 uppercase tracking-widest leading-none text-right">
                                Bank<span className="text-blue-300">Value</span>
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 tracking-widest mt-1 text-right">
                                Performance Benchmarks
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Body Content */}
                <div className="flex-1 w-full p-10 relative overflow-hidden bg-white">
                    {activeSlide.content}
                </div>

                {/* Mandatory IB Footer */}
                <div className="w-full px-10 py-4 border-t border-slate-200 flex justify-between items-center flex-shrink-0 bg-white z-20">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        STRICTLY CONFIDENTIAL — DO NOT DISTRIBUTE OR COPY
                    </div>
                    <div className="text-xs font-bold text-slate-500">
                        {selectedBank.NAME}
                    </div>
                </div>

                {/* Branding Stripe */}
                <div className="w-full h-1.5 bg-blue-900 absolute bottom-0 left-0 z-30"></div>
            </div>
        </div>
    );
};

export default PitchbookPresentation;
