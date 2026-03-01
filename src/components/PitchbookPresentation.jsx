import React, { useState, useEffect, useCallback } from 'react';
import GaugeChart from './GaugeChart';
import MoversView from './MoversView';
import Sparkline from './Sparkline';
import { formatAssets } from '../utils/formatUtils';
import { CORE_FINANCIAL_GAUGES } from '../utils/gaugeConfigs';

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
    const [direction, setDirection] = useState('forward'); // for directional transitions (#2)
    const [aiSummaryHtml, setAiSummaryHtml] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const presentationRef = React.useRef(null);

    const getBenchmark = (key) => benchmarks ? parseFloat(benchmarks[key]) : 0;

    // Load AI summary from localStorage if the user already generated one in this session.
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

    // #5 — extract a short topic label from each AI bullet for a smarter heading
    const extractInsightTopic = (bullet) => {
        const topics = [
            { match: /efficiency ratio|efficiency/i, label: 'Cost Efficiency' },
            { match: /return on assets|\broa\b/i, label: 'Return on Assets' },
            { match: /return on equity|\broe\b/i, label: 'Return on Equity' },
            { match: /net interest margin|\bnim\b/i, label: 'Net Interest Margin' },
            { match: /asset growth/i, label: 'Asset Growth' },
            { match: /non-performing|\bnpl\b/i, label: 'Loan Quality' },
            { match: /capital/i, label: 'Capital Adequacy' },
            { match: /deposit/i, label: 'Deposit Base' },
            { match: /loan/i, label: 'Loan Portfolio' },
        ];
        for (const { match, label } of topics) {
            if (match.test(bullet)) return label;
        }
        return bullet.replace(/[^a-zA-Z\s]/g, '').split(/\s+/).filter(w => w.length > 3).slice(0, 3).join(' ') || 'Key Finding';
    };

    const getAiBullets = () => {
        let bullets = [];
        if (aiSummaryHtml) {
            // Extract bullet points from the AI markdown summary
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
                `${selectedBank.NAME} holds ${formatAssets(financials.raw.ASSET)} in total assets.`,
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
                        <h1 className="text-4xl md:text-5xl font-black font-serif text-slate-800 tracking-tight uppercase">
                            Executive Briefing
                        </h1>
                        <p className="text-xl md:text-2xl text-slate-500 font-serif italic mt-4 tracking-wide">
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
                        <p className="text-slate-500 text-sm font-bold tracking-widest uppercase">{currentQuarter} Performance Review</p>
                    </div>
                </div>
            )
        },
        {
            id: 'agenda',
            isDivider: true,
            content: (
                <div className="flex flex-col items-center justify-center h-full animate-in fade-in slide-in-from-right-8 duration-700">
                    <div className="w-full max-w-4xl px-16 py-12 bg-white shadow-xl border-t-8 border-blue-900">
                        <h2 className="text-3xl font-serif font-black text-slate-800 mb-10 pb-4 border-b-2 border-slate-100 uppercase tracking-widest">Agenda</h2>
                        <div className="space-y-4">
                            {/* #8 — clickable agenda items jump to the relevant slide */}
                            {[{ num: 'I.', label: 'Strategic Summary & Key Insights', idx: 3 },
                            { num: 'II.', label: 'Core Financial Benchmarking', idx: 5 },
                            { num: 'III.', label: 'Competitive Radar & Positioning', idx: 7 },
                            { num: 'IV.', label: 'Forward-Looking Strategy', idx: 9 }].map(item => (
                                <button
                                    key={item.num}
                                    onClick={() => { setDirection('forward'); setCurrentSlide(item.idx); }}
                                    className="flex items-center gap-6 w-full text-left group hover:bg-slate-50 rounded px-2 py-2 transition-colors"
                                >
                                    <span className="text-2xl font-serif font-black text-slate-300 group-hover:text-blue-300 transition-colors w-12 shrink-0">{item.num}</span>
                                    <span className="text-xl font-medium text-slate-700 tracking-wide uppercase group-hover:text-blue-900 transition-colors flex-1">{item.label}</span>
                                    <svg className="ml-auto w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'divider-1',
            isDivider: true,
            content: (
                <div className="flex flex-col items-start justify-center h-full w-full bg-blue-900 px-24 animate-in fade-in slide-in-from-right-8 duration-500">
                    <h2 className="text-5xl font-serif font-black text-white mb-4">I. Strategic Summary</h2>
                    <div className="w-24 h-1.5 bg-blue-400"></div>
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
                            const topic = extractInsightTopic(bullet); // #5 smart heading
                            return (
                                <div key={idx} className={`flex items-start gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both delay-${(idx + 1) * 200}`}>
                                    <div className="w-12 h-12 rounded-sm bg-blue-900 flex items-center justify-center flex-shrink-0 mt-1 shadow-md">
                                        <span className="text-white font-black text-xl">{idx + 1}</span>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-blue-900 mb-1 uppercase tracking-wide">{topic}</h3>
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
            id: 'divider-2',
            isDivider: true,
            content: (
                <div className="flex flex-col items-start justify-center h-full w-full bg-blue-900 px-24 animate-in fade-in slide-in-from-right-8 duration-500">
                    <h2 className="text-5xl font-serif font-black text-white mb-4">II. Core Financial Benchmarking</h2>
                    <div className="w-24 h-1.5 bg-blue-400"></div>
                </div>
            )
        },
        {
            id: 'financial',
            actionTitle: `Core Financial Performance vs. ${benchmarks?.groupName || 'Peers'}`,
            actionSubtitle: "A distilled view of the most critical financial health and profitability indicators against the benchmark.",
            source: `Source: FDIC Call Report Data, ${currentQuarter}; Peer Group: ${benchmarks?.groupName || 'Segment'}`,  // #1
            content: (
                <div className="w-full h-full flex flex-col justify-start pt-6 px-8 gap-4 overflow-hidden">
                    <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-3 gap-y-6 gap-x-8 justify-items-center content-start animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both">
                        {CORE_FINANCIAL_GAUGES.map(cfg => (
                            <GaugeChart
                                key={cfg.key}
                                label={cfg.label}
                                value={parseFloat(financials[cfg.key]) || 0}
                                min={cfg.min}
                                max={cfg.max}
                                average={benchmarks ? parseFloat(benchmarks[cfg.key]) : null}
                                p25={benchmarks?.p25?.[cfg.key]}
                                p75={benchmarks?.p75?.[cfg.key]}
                                inverse={cfg.inverse || false}
                                suffix={cfg.suffix || '%'}
                                metric={cfg.metric}
                                isActive={currentSlide === 5} // #6 needle sweep
                                isLightMode={true}
                            />
                        ))}
                    </div>
                    {/* How to Read — inline legend bar beneath gauge grid */}
                    <div className="w-full flex-shrink-0 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-6 py-3 animate-in fade-in duration-500 delay-500 fill-mode-both">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-6">How to Read</span>
                        {/* Needle & peer icons */}
                        <div className="flex items-center gap-6 mr-auto">
                            <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                                {/* Needle icon for Selected Bank */}
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="7" cy="11" r="2.5" fill="#1e293b" />
                                    <line x1="7" y1="11" x2="7" y2="2" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                                Selected Bank
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                                {/* Dashed line for Peer Median */}
                                <svg width="18" height="4" viewBox="0 0 18 4" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <line x1="0" y1="2" x2="18" y2="2" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 2" />
                                </svg>
                                Peer Median
                            </div>
                        </div>
                        {/* Color zone key */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block flex-shrink-0"></span>
                                Below Average
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block flex-shrink-0"></span>
                                Approaching Avg
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block flex-shrink-0"></span>
                                Outperforming
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'divider-3',
            isDivider: true,
            content: (
                <div className="flex flex-col items-start justify-center h-full w-full bg-blue-900 px-24 animate-in fade-in slide-in-from-right-8 duration-500">
                    <h2 className="text-5xl font-serif font-black text-white mb-4">III. Competitive Radar</h2>
                    <div className="w-24 h-1.5 bg-blue-400"></div>
                </div>
            )
        },
        {
            id: 'radar-threats',
            actionTitle: "Market Positioning & Peer Distribution",
            actionSubtitle: "Competitive outliers with the highest surprise score — deteriorating relative to the peer group.",
            content: (
                <div className="w-full overflow-y-auto animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 fill-mode-both" style={{ height: '100%', maxHeight: '100%' }}>
                    <MoversView
                        dataProvider={fdicService}
                        perspectiveBankName={selectedBank.NAME}
                        focusBankCert={String(selectedBank.CERT)}
                        segmentKey={benchmarks?.assetFilter || 'ASSET:[50000000 TO 250000000]'}
                        segmentLabel={benchmarks?.groupName || 'Peer Group'}
                        priorQuarter={priorQuarter}
                        currentQuarter={currentQuarter}
                        onDrillDown={() => { }}
                        onShowBrief={() => { }}
                        isPresentationMode={true}
                        forcedTab="threats"
                    />
                </div>
            )
        },
        {
            id: 'radar-playbooks',
            actionTitle: "Market Positioning & Peer Distribution",
            actionSubtitle: "Competitive outliers with the highest surprise score — outperforming relative to the peer group.",
            source: `Source: BankValue Analytics; Peer Group: ${benchmarks?.groupName || 'Segment'}`,
            content: (
                <div className="w-full overflow-y-auto animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 fill-mode-both" style={{ height: '100%', maxHeight: '100%' }}>
                    <MoversView
                        dataProvider={fdicService}
                        perspectiveBankName={selectedBank.NAME}
                        focusBankCert={String(selectedBank.CERT)}
                        segmentKey={benchmarks?.assetFilter || 'ASSET:[50000000 TO 250000000]'}
                        segmentLabel={benchmarks?.groupName || 'Peer Group'}
                        priorQuarter={priorQuarter}
                        currentQuarter={currentQuarter}
                        onDrillDown={() => { }}
                        onShowBrief={() => { }}
                        isPresentationMode={true}
                        forcedTab="playbooks"
                    />
                </div>
            )
        },
        {
            id: 'planner',
            actionTitle: "Forward-Looking Strategy & Rate Shock",
            actionSubtitle: "Modeling the theoretical impact of interest rate movements on Net Interest Margin and baseline profitability.",
            source: "Source: BankValue Scenario Modeler. Forecasts are illustrative.",
            content: (() => {
                const nim = parseFloat(financials.netInterestMargin) || 0;
                const cof = parseFloat(financials.costOfFunds) || 0;
                const roa = parseFloat(financials.returnOnAssets) || 0;
                const bNim = getBenchmark('netInterestMargin');
                const bCof = getBenchmark('costOfFunds');
                const bRoa = getBenchmark('returnOnAssets');
                const nimGap = (nim - bNim).toFixed(2);
                const cofGap = (cof - bCof).toFixed(2);
                const roaGap = (roa - bRoa).toFixed(2);
                const scenarios = [
                    { label: 'Rate +100bps', nimImpact: (nim + 0.15).toFixed(2), roaImpact: (roa + 0.05).toFixed(2), color: 'text-emerald-600' },
                    { label: 'Rate Flat', nimImpact: nim.toFixed(2), roaImpact: roa.toFixed(2), color: 'text-slate-700' },
                    { label: 'Rate -100bps', nimImpact: (nim - 0.15).toFixed(2), roaImpact: (roa - 0.05).toFixed(2), color: 'text-rose-600' },
                ];
                return (
                    <div className="w-full h-full flex flex-col justify-center gap-6 px-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 fill-mode-both">
                        {/* Gap vs Benchmark Row */}
                        <div className="grid grid-cols-3 gap-4">
                            {[
                                { label: 'Net Interest Margin', value: nim.toFixed(2), peer: bNim.toFixed(2), gap: nimGap, better: nim >= bNim },
                                { label: 'Cost of Funds', value: cof.toFixed(2), peer: bCof.toFixed(2), gap: cofGap, better: cof <= bCof },
                                { label: 'Return on Assets', value: roa.toFixed(2), peer: bRoa.toFixed(2), gap: roaGap, better: roa >= bRoa },
                            ].map(m => (
                                <div key={m.label} className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center shadow-sm">
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{m.label}</div>
                                    <div className="text-2xl font-black text-slate-800">{m.value}%</div>
                                    <div className="text-xs text-slate-500 mt-1">Peer Avg: {m.peer}%</div>
                                    <div className={`text-sm font-bold mt-1 ${m.better ? 'text-emerald-600' : 'text-rose-500'}`}>
                                        Gap: {m.gap > 0 ? '+' : ''}{m.gap}%
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Rate Shock Scenarios */}
                        <div>
                            <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Rate Shock Scenarios (Illustrative)</div>
                            <div className="overflow-hidden rounded-lg border border-slate-200">
                                <table className="w-full text-sm">
                                    <thead><tr className="bg-slate-800 text-white">
                                        <th className="px-4 py-2 text-left font-bold">Scenario</th>
                                        <th className="px-4 py-2 text-right font-bold">Est. NIM</th>
                                        <th className="px-4 py-2 text-right font-bold">Est. ROA</th>
                                    </tr></thead>
                                    <tbody>
                                        {scenarios.map((s, i) => (
                                            <tr key={s.label} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                <td className="px-4 py-3 font-semibold text-slate-700">{s.label}</td>
                                                <td className={`px-4 py-3 text-right font-black ${s.color}`}>{s.nimImpact}%</td>
                                                <td className={`px-4 py-3 text-right font-black ${s.color}`}>{s.roaImpact}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <p className="text-[9px] italic text-slate-400">Scenarios assume linear sensitivity. Actual results depend on asset/liability repricing mix. For illustrative purposes only.</p>
                    </div>
                );
            })()
        }
    ];

    const handleNext = useCallback(() => {
        if (currentSlide < slides.length - 1) {
            setDirection('forward');   // #2 directional transitions
            setCurrentSlide(currentSlide + 1);
        }
    }, [currentSlide, slides.length]);

    const handlePrev = useCallback(() => {
        if (currentSlide > 0) {
            setDirection('backward');  // #2 directional transitions
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
            // Request fullscreen on the html element (not the fixed div — browsers refuse that)
            document.documentElement.requestFullscreen().catch(err => console.error('Fullscreen error:', err));
        } else {
            document.exitFullscreen().catch(err => console.error(err));
        }
    };

    const activeSlide = slides[currentSlide];

    return (
        <div ref={presentationRef} className="pitchbook-root fixed inset-0 z-[200] bg-[#e2e8f0] flex flex-col items-center justify-center font-sans">
            {/* SCREEN VIEW */}
            <div className="screen-only w-full h-full flex flex-col items-center justify-center pt-20 pb-4">
                {/* Top Navigation Frame (Outside the slide canvas) */}
                <div className="pitchbook-nav absolute top-0 w-full flex items-center justify-between p-4 bg-slate-800 text-white shadow-md z-10">
                    <button
                        onClick={onClose}
                        aria-label="Close presentation" // #9
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
                        {/* #5 — Save as PDF shortcut */}
                        <button
                            onClick={() => window.print()}
                            aria-label="Save as PDF"
                            title="Save as PDF (Ctrl+P)"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors outline-none bg-slate-700 hover:bg-emerald-700 text-slate-300 hover:text-white border border-slate-600 hover:border-emerald-500"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            Save as PDF
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
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
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

                {/* Formal 16:9 IB Slide Canvas */}
                <div
                    className="pitchbook-canvas bg-white shadow-2xl relative flex flex-col overflow-hidden screen-only"
                    style={{
                        width: '95vw',
                        maxWidth: '1600px',
                        aspectRatio: '16/9',
                        maxHeight: '90vh' // Ensure it doesn't overflow vertically on small screens
                    }}
                >
                    {/* #10 — thin progress bar at the very top edge of the canvas */}
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

                    {/* Main Body Content */}
                    <div
                        // #2 — directional transitions: forward slides in from right, back from left
                        key={currentSlide}
                        className={`flex-1 w-full relative overflow-hidden animate-in fade-in duration-400 fill-mode-both ${direction === 'forward' ? 'slide-in-from-right-6' : 'slide-in-from-left-6'
                            } ${activeSlide.isDivider ? '' : 'p-10 bg-white'}`}
                    >
                        {/* #11 — page number on divider slides */}
                        {activeSlide.isDivider && (
                            <div className="absolute bottom-4 right-8 text-white/30 text-xs font-bold tracking-widest">
                                {currentSlide + 1} / {slides.length}
                            </div>
                        )}
                        {activeSlide.content}
                    </div>

                    {/* Mandatory IB Footer */}
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

                    {/* Branding Stripe */}
                    <div className="w-full h-1.5 bg-blue-900 absolute bottom-0 left-0 z-30"></div>
                </div>
            </div>

            {/* PRINT VIEW (Render all slides for Save as PDF) */}
            <div className="print-only">
                {slides.map((slide, printIdx) => (
                    <div key={`print-slide-${printIdx}`} className="pitchbook-print-slide bg-white relative flex flex-col overflow-hidden">
                        {!slide.isCover && !slide.isDivider && (
                            <div className="w-full px-10 pt-8 pb-4 border-b-2 border-slate-800 flex justify-between items-end flex-shrink-0">
                                <div className="max-w-4xl">
                                    <h2 className="text-3xl font-black text-blue-900 tracking-tight leading-tight">
                                        {slide.actionTitle}
                                    </h2>
                                    {slide.actionSubtitle && (
                                        <p className="text-slate-500 font-medium text-lg mt-1 tracking-wide">
                                            {slide.actionSubtitle}
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
                        <div className={`flex-1 w-full relative overflow-hidden ${slide.isDivider ? '' : 'p-10 bg-white'}`}>
                            {slide.content}
                        </div>
                        <div className="w-full px-10 py-4 border-t border-slate-200 flex justify-between items-end flex-shrink-0 bg-white z-20">
                            <div>
                                {slide.source && (
                                    <div className="text-[9px] font-serif font-medium italic text-slate-500 mb-1.5">
                                        {slide.source}
                                    </div>
                                )}
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                    STRICTLY CONFIDENTIAL — DO NOT DISTRIBUTE OR COPY
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs font-bold text-slate-500 mb-1">
                                    {selectedBank.NAME}
                                </div>
                                <div className="text-[10px] text-slate-400 font-bold tracking-widest">
                                    {printIdx + 1} / {slides.length}
                                </div>
                            </div>
                        </div>
                        <div className="w-full h-1.5 bg-blue-900 absolute bottom-0 left-0 z-30"></div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PitchbookPresentation;
