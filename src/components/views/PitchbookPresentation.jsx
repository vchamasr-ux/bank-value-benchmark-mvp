import React, { useState, useEffect, useCallback } from 'react';
import Slide8_StrategyBrief from './Slide8_StrategyBrief';
import { parseAiBullets } from '../../utils/pitchbookUtils';

// Import newly refactored slide components
import { SlideCover } from './pitchbook/SlideCover';
import { SlideAgenda } from './pitchbook/SlideAgenda';
import { SlideInsights } from './pitchbook/SlideInsights';
import { SlideFinancials } from './pitchbook/SlideFinancials';
import { SlidePlanner } from './pitchbook/SlidePlanner';
import { SlideDivider } from './pitchbook/SlideDivider';

const PitchbookPresentation = ({
    selectedBank,
    financials,
    benchmarks,
    fdicService,
    onClose,
    priorQuarter = 'Q3 2025',
    currentQuarter = 'Q4 2025',
}) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [direction, setDirection] = useState('forward');
    const [isLinkCopied, setIsLinkCopied] = useState(false);
    const [aiSummaryHtml, setAiSummaryHtml] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const presentationRef = React.useRef(null);

    const getBenchmark = (key) => benchmarks ? parseFloat(benchmarks[key]) : 0;

    // Load AI summary from localStorage
    useEffect(() => {
        const cachedKey = `benchmark_summary_${financials.raw.CERT}`;
        const cached = localStorage.getItem(cachedKey);
        if (cached) {
            try {
                const data = JSON.parse(cached);
                if (data.markdown) {
                    Promise.resolve().then(() => setAiSummaryHtml(data.markdown));
                }
            } catch {
                console.warn("Failed to parse cached summary");
            }
        }
    }, [financials.raw.CERT]);

    const aiBullets = parseAiBullets(aiSummaryHtml, selectedBank, financials, getBenchmark);

    // Slides Array - now streamlined and delegating complex UI to isolated components
    const slides = [
        {
            id: 'title',
            isCover: true,
            content: <SlideCover selectedBank={selectedBank} currentQuarter={currentQuarter} />
        },
        {
            id: 'agenda',
            isDivider: true,
            content: <SlideAgenda setDirection={setDirection} setCurrentSlide={setCurrentSlide} />
        },
        {
            id: 'divider-1',
            isDivider: true,
            content: <SlideDivider title="I. Strategic Summary" />
        },
        {
            id: 'insights',
            actionTitle: "Strategic Summary & Key Insights",
            actionSubtitle: "High-level performance assessment relative to regional peer institutions.",
            content: <SlideInsights aiBullets={aiBullets} financials={financials} getBenchmark={getBenchmark} />
        },
        {
            id: 'divider-2',
            isDivider: true,
            content: <SlideDivider title="II. Core Financial Benchmarking" />
        },
        {
            id: 'financial',
            actionTitle: `Core Financial Performance vs. ${benchmarks?.groupName || 'Peers'}`,
            actionSubtitle: "A distilled view of the most critical financial health and profitability indicators against the benchmark.",
            source: `Source: FDIC Call Report Data, ${currentQuarter}; Peer Group: ${benchmarks?.groupName || 'Segment'}`,
            content: <SlideFinancials financials={financials} benchmarks={benchmarks} currentSlide={currentSlide} />
        },
        {
            id: 'divider-3',
            isDivider: true,
            content: <SlideDivider title="III. Competitive Landscape: Strategic Imperatives" />
        },
        {
            id: 'strategy-brief',
            actionTitle: "Competitive Landscape: Strategic Imperatives",
            actionSubtitle: "Top 4 peer anomalies ranked by market surprise — with action-oriented imperatives for JPMorgan.",
            source: `Source: BankValue Intelligence; Peer Group: ${benchmarks?.groupName || 'Segment'}`,
            content: (
                <div className="w-full h-full relative" style={{ height: '100%', maxHeight: '100%' }}>
                    <Slide8_StrategyBrief
                        dataProvider={fdicService}
                        focusBankCert={String(selectedBank.CERT)}
                        focusBankName={selectedBank.name || selectedBank.REPDTE}
                        segmentKey={benchmarks?.assetFilter || 'ASSET:[50000000 TO 250000000]'}
                        segmentLabel={benchmarks?.groupName || 'Peer Group'}
                        priorQuarter={priorQuarter}
                        currentQuarter={currentQuarter}
                        isPresentationMode={true}
                    />
                </div>
            )
        },
        {
            id: 'planner',
            actionTitle: "Forward-Looking Strategy & Rate Shock",
            actionSubtitle: "Modeling the theoretical impact of interest rate movements on Net Interest Margin and baseline profitability.",
            source: "Source: BankValue Scenario Modeler. Forecasts are illustrative.",
            content: <SlidePlanner financials={financials} getBenchmark={getBenchmark} />
        }
    ];

    const handleNext = useCallback(() => {
        if (currentSlide < slides.length - 1) {
            setDirection('forward');
            setCurrentSlide(currentSlide + 1);
        }
    }, [currentSlide, slides.length]);

    const handlePrev = useCallback(() => {
        if (currentSlide > 0) {
            setDirection('backward');
            setCurrentSlide(currentSlide - 1);
        }
    }, [currentSlide]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight' || e.key === 'Space') { setDirection('forward'); handleNext(); }
            else if (e.key === 'ArrowLeft') { setDirection('backward'); handlePrev(); }
            else if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleNext, handlePrev, onClose]);

    // Fullscreen Event Listener
    useEffect(() => {
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.error('Fullscreen error:', err));
        } else {
            document.exitFullscreen().catch(err => console.error(err));
        }
    };

    const handleCopyLink = () => {
        const url = new URL(window.location.href);
        url.searchParams.set('present', 'true');
        const urlString = url.toString();

        if (navigator.clipboard) {
            navigator.clipboard.writeText(urlString).then(() => {
                setIsLinkCopied(true);
                setTimeout(() => setIsLinkCopied(false), 2000);
            }).catch(err => {
                console.error('Failed to copy via clipboard API', err);
                fallbackCopyTextToClipboard(urlString);
            });
        } else {
            fallbackCopyTextToClipboard(urlString);
        }
    };

    const fallbackCopyTextToClipboard = (text) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            setIsLinkCopied(true);
            setTimeout(() => setIsLinkCopied(false), 2000);
        } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
        }
        document.body.removeChild(textArea);
    };

    const activeSlide = slides[currentSlide];

    return (
        <div ref={presentationRef} className="pitchbook-root fixed inset-0 z-[200] bg-[#e2e8f0] flex flex-col items-center justify-center font-sans">
            <div className="screen-only w-full h-full flex flex-col items-center justify-center pt-20 pb-4">
                <div className="pitchbook-nav absolute top-0 w-full flex items-center justify-between p-4 bg-slate-800 text-white shadow-md z-10">
                    <button
                        onClick={onClose}
                        aria-label="Close presentation"
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
                    <div className="flex gap-2 items-center">
                        <button
                            onClick={handleCopyLink}
                            aria-label="Copy presentation link"
                            title="Copy link to this pitchbook"
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors outline-none border ${isLinkCopied
                                ? 'bg-emerald-600 text-white border-emerald-500'
                                : 'bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white border-slate-600 hover:border-blue-500'
                                }`}
                        >
                            {isLinkCopied ? (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                            )}
                            {isLinkCopied ? 'Copied!' : 'Copy Link'}
                        </button>

                        <button
                            onClick={toggleFullscreen}
                            aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors outline-none bg-slate-700 hover:bg-emerald-700 text-slate-300 hover:text-white border border-slate-600 hover:border-emerald-500"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                {isFullscreen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M15 9V4.5M15 9h4.5M9 15v4.5M9 15H4.5M15 15v4.5M15 15h4.5" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l-5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                )}
                            </svg>
                            {isFullscreen ? "Exit Full" : "Full Screen"}
                        </button>
                        <button
                            onClick={handlePrev}
                            disabled={currentSlide === 0}
                            aria-label="Previous slide"
                            className={`px-4 py-1.5 rounded text-sm font-bold transition-colors outline-none ${currentSlide === 0 ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
                        >
                            Prev
                        </button>
                        <button
                            onClick={handleNext}
                            disabled={currentSlide === slides.length - 1}
                            aria-label="Next slide"
                            className={`px-4 py-1.5 rounded text-sm font-bold transition-colors outline-none ${currentSlide === slides.length - 1 ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'}`}
                        >
                            Next
                        </button>
                    </div>
                </div>

                <div
                    className="pitchbook-canvas bg-white shadow-2xl relative flex flex-col overflow-hidden screen-only"
                    style={{ width: '95vw', maxWidth: '1600px', aspectRatio: '16/9', maxHeight: '90vh' }}
                >
                    <div className="absolute top-0 left-0 h-0.5 bg-blue-200 w-full z-30">
                        <div
                            className="h-full bg-blue-600 transition-all duration-500 ease-out"
                            style={{ width: `${((currentSlide) / (slides.length - 1)) * 100}%` }}
                        />
                    </div>
                    {!activeSlide.isCover && !activeSlide.isDivider && (
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

                    <div
                        key={currentSlide}
                        className={`flex-1 w-full relative overflow-hidden animate-in fade-in duration-400 fill-mode-both ${direction === 'forward' ? 'slide-in-from-right-6' : 'slide-in-from-left-6'
                            } ${activeSlide.isDivider ? '' : 'p-10 bg-white'}`}
                    >
                        {activeSlide.isDivider && (
                            <div className="absolute bottom-4 right-8 text-white/30 text-xs font-bold tracking-widest">
                                {currentSlide + 1} / {slides.length}
                            </div>
                        )}
                        {activeSlide.content}
                    </div>

                    <div className="w-full px-10 py-4 border-t border-slate-200 flex justify-between items-end flex-shrink-0 bg-white z-20">
                        <div>
                            {activeSlide.source && (
                                <div className="text-[9px] font-serif font-medium italic text-slate-500 mb-1.5">
                                    {activeSlide.source}
                                </div>
                            )}
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                STRICTLY CONFIDENTIAL — DO NOT DISTRIBUTE OR COPY
                            </div>
                        </div>
                        <div className="text-xs font-bold text-slate-500">
                            {selectedBank.NAME}
                        </div>
                    </div>

                    <div className="w-full h-1.5 bg-blue-900 absolute bottom-0 left-0 z-30"></div>
                </div>
            </div>
        </div>
    );
};

export default PitchbookPresentation;
