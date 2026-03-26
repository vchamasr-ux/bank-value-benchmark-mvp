import Sparkline from '../../charts/Sparkline';
import { extractInsightTopic, matchBulletToMetric } from '../../../utils/pitchbookUtils';

export const SlideInsights = ({ aiBullets, financials, getBenchmark }) => (
    <div className="w-full h-full flex items-center justify-center px-12">
        <div className="w-full space-y-8">
            {aiBullets.map((bullet, idx) => {
                const matchedMetric = matchBulletToMetric(bullet, financials, getBenchmark);
                const topic = extractInsightTopic(bullet);
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
);
