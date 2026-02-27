import React, { useState, useEffect } from 'react';

const StrategicPlannerTab = ({ financials, benchmarks }) => {
    const [model, setModel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [targetKpi, setTargetKpi] = useState('returnOnAssets');
    const [targetType, setTargetType] = useState('peer_median');
    const [horizon, setHorizon] = useState('4q');

    // Calculated State
    const [paths, setPaths] = useState([]);
    const [gap, setGap] = useState(0);
    const [currentTarget, setCurrentTarget] = useState(0);
    const [currentValue, setCurrentValue] = useState(0);

    useEffect(() => {
        const fetchModel = async () => {
            try {
                // Fetch the static artifact
                const response = await fetch('/models/whatwouldittake_v2.json');
                if (!response.ok) {
                    throw new Error('Model artifact missing or inaccessible. Run offline training pipeline.');
                }
                const data = await response.json();

                // Validate schema version
                if (!data.schema_version) {
                    throw new Error('Invalid model architecture. Missing schema_version.');
                }

                setModel(data);
                setError(null);
            } catch (err) {
                console.error("Strategic Planner initialization failed:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchModel();
    }, []);

    // Core Scenario Engine Logic
    useEffect(() => {
        if (!model || !financials || !benchmarks) return;

        try {
            // 1. Determine Current vs Target
            const cVal = parseFloat(financials[targetKpi]);
            if (isNaN(cVal)) throw new Error(`Missing current KPI: ${targetKpi}`);

            let tVal;
            if (targetType === 'peer_median') {
                tVal = parseFloat(benchmarks[targetKpi]);
            } else if (targetType === 'peer_top_quartile') {
                // Determine if higher is better based on KPI
                const lowerIsBetter = ['costOfFunds', 'efficiencyRatio', 'nptlRatio'].includes(targetKpi);
                tVal = lowerIsBetter ? parseFloat(benchmarks?.p25?.[targetKpi]) : parseFloat(benchmarks?.p75?.[targetKpi]);
            }

            if (isNaN(tVal)) throw new Error(`Missing benchmark for: ${targetKpi}`);

            setCurrentValue(cVal);
            setCurrentTarget(tVal);

            // Calculate required delta Y
            const deltaY = tVal - cVal;
            setGap(deltaY);

            // 2. Generate Paths
            const targetModel = model.targets[targetKpi];
            if (!targetModel) throw new Error(`No trained model for target: ${targetKpi}`);

            const newPaths = [];
            const activeLevers = model.features;
            const bounds = model.lever_bounds[horizon];

            // Helper to create a single-lever path
            const createSingleLeverPath = (leverIdx, name, type) => {
                const leverName = activeLevers[leverIdx];
                const coef = targetModel.coef[leverIdx];

                if (Math.abs(coef) < 0.0001) return null; // Lever has no effect

                // Required move = delta Y / Coefficient
                let requiredMove = deltaY / coef;

                // Clamp to bounds
                const bound = bounds[leverName];
                if (bound) {
                    if (requiredMove > bound.max) { requiredMove = bound.max; }
                    if (requiredMove < bound.min) { requiredMove = bound.min; }
                }

                return {
                    id: leverName,
                    type: type,
                    title: `Adjust ${formatLabel(leverName)}`,
                    prescribedDelta: requiredMove,
                    coef: coef,
                    idx: leverIdx
                };
            };

            // Path 1: The "Most Powerful" single lever (Highest absolute coefficient)
            let bestLeverIdx = 0;
            let maxEffect = 0;
            activeLevers.forEach((lever, idx) => {
                const effect = Math.abs(targetModel.coef[idx]);
                if (effect > maxEffect) {
                    maxEffect = effect;
                    bestLeverIdx = idx;
                }
            });
            const pathA = createSingleLeverPath(bestLeverIdx, "Primary Driver", "primary");
            if (pathA) newPaths.push(pathA);

            // Path 2: Find a secondary lever (if delta isn't closed by Path 1, or just as an alternative)
            let secondBestIdx = -1;
            let secondMax = 0;
            activeLevers.forEach((lever, idx) => {
                const effect = Math.abs(targetModel.coef[idx]);
                // Need a lever that pushes in the right direction (coef * deltaY > 0) or we just pick the next strongest
                // For simplicity in V1, just pick the second strongest absolute lever
                if (idx !== bestLeverIdx && effect > secondMax) {
                    secondMax = effect;
                    secondBestIdx = idx;
                }
            });
            if (secondBestIdx !== -1) {
                const pathB = createSingleLeverPath(secondBestIdx, "Secondary Alternative", "secondary");
                if (pathB) newPaths.push(pathB);
            }

            setPaths(newPaths);

        } catch (err) {
            console.error("Error solving scenario:", err);
            // Non-fatal, just clear paths
            setPaths([]);
        }
    }, [model, financials, benchmarks, targetKpi, targetType, horizon]);

    if (!financials) return null;

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64 text-blue-600 animate-pulse font-bold">
                Loading Strategic Planner Engine...
            </div>
        );
    }

    if (error) {
        // "Fail Loudly" display
        return (
            <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg shadow-sm">
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-red-800 tracking-tight">Initialization Failed</h3>
                        <p className="mt-2 text-sm text-red-700 font-medium">
                            The Strategic Planner requires a valid offline-trained model artifact to function. It refuses to guess scenarios.
                        </p>
                        <p className="mt-1 text-xs text-red-600 font-mono bg-red-100 p-2 rounded">
                            {error}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Helper to format camelCase KPI names
    const formatLabel = (key) => {
        const labels = {
            returnOnAssets: 'Return on Assets',
            costOfFunds: 'Cost of Funds',
            efficiencyRatio: 'Efficiency Ratio',
            nonInterestIncomePercent: 'Non-Interest Income',
            yieldOnLoans: 'Yield on Loans',
            netInterestMargin: 'Net Interest Margin',
            nptlRatio: 'Non-Performing Loans'
        };
        return labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    };

    const InteractivePathCard = ({ path, model, financials, deltaY }) => {
        const leverName = path.id;
        const coef = path.coef;
        const currentVal = parseFloat(financials[leverName]) || 0;

        const [sliderDelta, setSliderDelta] = useState(path.prescribedDelta);
        useEffect(() => setSliderDelta(path.prescribedDelta), [path.prescribedDelta]);

        const newLeverVal = currentVal + sliderDelta;
        const achievedDeltaY = sliderDelta * coef;
        const percentOfGoal = deltaY !== 0 ? Math.min(100, Math.max(0, (achievedDeltaY / deltaY) * 100)) : 100;

        // Confidence Check
        const confMetrics = model.confidence_metrics ? model.confidence_metrics[leverName] : null;
        let confidence = 'High';
        let confColor = 'bg-emerald-100 text-emerald-700';
        if (confMetrics) {
            if (newLeverVal < confMetrics.p10 || newLeverVal > confMetrics.p90) {
                confidence = 'Low (Anomaly)';
                confColor = 'bg-red-100 text-red-700';
            } else {
                confidence = 'High (Typical)';
            }
        }

        // Tradeoffs Check
        const tradeoffs = model.tradeoffs ? model.tradeoffs[leverName] : null;
        let topTradeoff = null;
        let maxCorr = 0;
        if (tradeoffs) {
            Object.entries(tradeoffs).forEach(([feat, corr]) => {
                if (feat !== leverName && Math.abs(corr) > Math.abs(maxCorr)) {
                    maxCorr = corr;
                    topTradeoff = feat;
                }
            });
        }
        const tradeoffImpact = topTradeoff ? sliderDelta * maxCorr : 0;

        // Bounds for slider
        const bounds = model.lever_bounds['4q'][leverName];
        let minBound = bounds ? bounds.min : -10;
        let maxBound = bounds ? bounds.max : 10;
        // Make sure slider covers current delta nicely if we are somehow outside
        if (sliderDelta < minBound) minBound = sliderDelta * 1.5;
        if (sliderDelta > maxBound) maxBound = sliderDelta * 1.5;

        return (
            <div className={`bg-white p-5 rounded-xl border-2 shadow-sm transition-colors relative overflow-hidden ${path.type === 'primary' ? 'border-emerald-500/30' : 'border-blue-500/20'}`}>
                <div className={`absolute top-0 right-0 px-3 py-1 text-xs font-black uppercase tracking-wider rounded-bl-lg ${path.type === 'primary' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                    Path {path.type === 'primary' ? 'A' : 'B'}
                </div>
                <h4 className="text-sm font-bold text-slate-800 mt-2 mb-4">{path.title}</h4>

                <div className="space-y-4">
                    <div className="flex justify-between items-center text-slate-600 font-bold text-sm">
                        <span>{formatLabel(leverName)}</span>
                        <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                            {currentVal.toFixed(2)}% &rarr; <span className="text-blue-600">{newLeverVal.toFixed(2)}%</span>
                        </span>
                    </div>

                    <input
                        type="range"
                        min={minBound}
                        max={maxBound}
                        step="0.01"
                        value={sliderDelta}
                        onChange={(e) => setSliderDelta(parseFloat(e.target.value))}
                        className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${path.type === 'primary' ? 'accent-emerald-600 bg-emerald-100' : 'accent-blue-600 bg-blue-100'}`}
                    />

                    <div className="w-full bg-slate-100 rounded-full h-2 flex overflow-hidden">
                        <div className={`h-2 rounded-full transition-all duration-300 ${percentOfGoal >= 100 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${Math.max(0, percentOfGoal)}%` }}></div>
                    </div>

                    <div className="flex justify-between items-center text-xs text-slate-500 font-bold">
                        <span>Delta: {sliderDelta > 0 ? '+' : ''}{sliderDelta.toFixed(2)} pts</span>
                        <span>Achieves {percentOfGoal.toFixed(0)}% of Goal</span>
                    </div>

                    <div className="pt-4 mt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                        <div className={`text-[10px] font-black uppercase px-2 py-1.5 rounded flex flex-col justify-center items-center text-center ${confColor}`}>
                            <span className="opacity-70 mb-0.5">Confidence</span>
                            <span>{confidence}</span>
                        </div>
                        {topTradeoff && maxCorr !== 0 && Math.abs(tradeoffImpact) > 0.05 ? (
                            <div className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1.5 rounded border border-amber-200 flex flex-col justify-center items-center text-center leading-tight">
                                <span className="opacity-70 mb-0.5">Tradeoff Warning</span>
                                <span>{formatLabel(topTradeoff)} {tradeoffImpact > 0 ? '+' : ''}{tradeoffImpact.toFixed(2)}%</span>
                            </div>
                        ) : (
                            <div className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1.5 rounded flex flex-col justify-center items-center text-center">
                                <span className="opacity-70 mb-0.5">Tradeoff Warning</span>
                                <span>Negligible impact</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };



    // Stub UI for V1 Layout
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <h2 className="text-2xl font-black text-blue-900 tracking-tight">
                        What Would It Take?
                    </h2>
                    <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-2 py-1 rounded text-xs font-bold shadow-sm uppercase tracking-wider">
                        Scenario Engine
                    </span>
                </div>
                {model && (
                    <div className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                        Model Version: {model.schema_version} (as of {model.trained_on.asof})
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left Column: Target Selector */}
                <div className="md:col-span-4 space-y-4">
                    <div className="bg-white border text-left border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -z-0"></div>
                        <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest mb-4 relative z-10">Configure Goal</h3>

                        <div className="space-y-4 relative z-10">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Target Metric</label>
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                                    value={targetKpi}
                                    onChange={(e) => setTargetKpi(e.target.value)}
                                >
                                    <option value="returnOnAssets">Return on Assets (ROA)</option>
                                    <option value="netInterestMargin">Net Interest Margin (NIM)</option>
                                    <option value="costOfFunds">Cost of Funds</option>
                                    <option value="nptlRatio">Non-Performing Loans (NPL)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Target Type</label>
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                                    value={targetType}
                                    onChange={(e) => setTargetType(e.target.value)}
                                >
                                    <option value="peer_median">Peer Median</option>
                                    <option value="peer_top_quartile">Top Quartile (75th)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Horizon</label>
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-blue-900 opacity-70 cursor-not-allowed"
                                    value={horizon}
                                    disabled
                                >
                                    <option value="4q">4 Quarters (1 Year)</option>
                                </select>
                                <p className="text-[10px] text-slate-400 mt-1">* Fixed for V1 stability</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Middle Column: Gap & Paths */}
                <div className="md:col-span-8 space-y-6">
                    <div className="bg-blue-900/5 p-6 rounded-xl border border-blue-100 relative text-left">
                        <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5V2a1 1 0 112 0v5a1 1 0 01-1 1h-5z" clipRule="evenodd" />
                                <path d="M2.293 12.293a1 1 0 011.414 0L11 4.586 15.586 9H13a1 1 0 110-2h5v5a1 1 0 11-2 0V9.414l-5.293 5.293a1 1 0 01-1.414 0L6 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L5.293 10 9 13.707l5.586-5.586L13 9.414V11a1 1 0 11-2 0v-5a1 1 0 011-1h5a1 1 0 110 2h-2.586l4.293 4.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0L6 11.414l-3.707 3.707a1 1 0 01-1.414-1.414l4.414-4.414L2.293 12.293z" />
                            </svg>
                            Required Lever Movements
                        </h3>

                        <div className="mb-6 flex items-center justify-between bg-white px-4 py-3 rounded-lg border border-slate-200">
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current {formatLabel(targetKpi)}</span>
                                <span className="text-xl font-black text-slate-700">{currentValue.toFixed(2)}%</span>
                            </div>
                            <div className="flex flex-col items-center px-4">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Gap</span>
                                <span className={`px-2 py-0.5 rounded font-bold text-sm ${gap > 0 ? 'bg-emerald-100 text-emerald-700' :
                                    gap < 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                                    }`}>
                                    {gap > 0 ? '+' : ''}{gap.toFixed(2)}%
                                </span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target ({targetType.replace('_', ' ')})</span>
                                <span className="text-xl font-black text-blue-900">{currentTarget.toFixed(2)}%</span>
                            </div>
                        </div>

                        {/* Stubs for paths */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {paths.length === 0 ? (
                                <div className="col-span-2 text-center py-8 text-sm text-slate-500 bg-white rounded-lg border border-dashed border-slate-300">
                                    Unable to calculate paths for this scenario.
                                </div>
                            ) : (
                                paths.map((path, idx) => (
                                    <InteractivePathCard
                                        key={path.id}
                                        path={path}
                                        model={model}
                                        financials={financials}
                                        deltaY={gap}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <div className="text-center text-xs text-slate-400 font-bold max-w-2xl mx-auto mt-8">
                Disclaimer: Scenarios are based on historical peer movements and ridge regression models. Not financial advice. Always consult your ALM model.
            </div>
        </div>
    );
};

export default StrategicPlannerTab;
