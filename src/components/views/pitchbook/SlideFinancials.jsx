import GaugeChart from '../../charts/GaugeChart';
import { CORE_FINANCIAL_GAUGES } from '../../../utils/gaugeConfigs';

export const SlideFinancials = ({ financials, benchmarks, currentSlide }) => (
    <div className="w-full h-full flex flex-col justify-start pt-6 px-8 gap-4 overflow-hidden">
        <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-3 gap-y-6 gap-x-8 justify-items-center content-start animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both">
            {CORE_FINANCIAL_GAUGES.map(cfg => (
                <GaugeChart
                    key={cfg.key}
                    label={cfg.label}
                    value={parseFloat(financials[cfg.key])}
                    min={cfg.min}
                    max={cfg.max}
                    average={benchmarks ? parseFloat(benchmarks[cfg.key]) : null}
                    p25={benchmarks?.p25?.[cfg.key]}
                    p75={benchmarks?.p75?.[cfg.key]}
                    inverse={cfg.inverse || false}
                    suffix={cfg.suffix || '%'}
                    metric={cfg.metric}
                    isActive={currentSlide === 5}
                    isLightMode={true}
                />
            ))}
        </div>
        <div className="w-full flex-shrink-0 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-6 py-3 animate-in fade-in duration-500 delay-500 fill-mode-both">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-6">How to Read</span>
            <div className="flex items-center gap-6 mr-auto">
                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="7" cy="11" r="2.5" fill="#1e293b" />
                        <line x1="7" y1="11" x2="7" y2="2" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    Selected Bank
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                    <svg width="18" height="4" viewBox="0 0 18 4" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <line x1="0" y1="2" x2="18" y2="2" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 2" />
                    </svg>
                    Peer Median
                </div>
            </div>
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
);
