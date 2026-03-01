import React, { useState, useEffect, useMemo, useCallback } from 'react';

// Module-level cache: the tiered model JSON is static and only needs to be fetched once.
let _cachedModelJson = null;

const ALL_KPIS = [
    { id: 'returnOnAssets', label: 'Return on Assets (ROA)' },
    { id: 'netInterestMargin', label: 'Net Interest Margin (NIM)' },
    { id: 'costOfFunds', label: 'Cost of Funds' },
    { id: 'efficiencyRatio', label: 'Efficiency Ratio' },
    { id: 'nptlRatio', label: 'Non-Performing Loans (NPL)' }
];

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

const calculateCagr = (currentVal, newVal, years) => {
    if (newVal === currentVal) return 0;

    // Mathematical Workaround for Negative Start Values (e.g., Negative ROA)
    // We cannot take the root of a negative ratio if currentVal is negative or crossing zero.
    // Solution: Shift both values by an offset such that the starting value becomes undeniably positive.
    // E.g., if ROA is -0.5 and target is 1.0, we shift by Math.abs(-0.5) + 1 = 1.5. 
    // Start becomes 1.0, Target becomes 2.5. We then calculate CAGR on this "shifted growth path".
    // This allows us to quantify the required rate of absolute value generation over the timeframe
    // without crashing or returning NaN.
    let base = parseFloat(currentVal);
    let target = parseFloat(newVal);

    if (base <= 0) {
        const offset = Math.abs(base) + 1;
        base += offset;
        target += offset;
    }

    return (Math.pow(target / base, 1 / years) - 1) * 100;
};

const ComboPathCard = ({ path, financials, deltaY, timeHorizon }) => {
    // For combins, calculate total achieved Delta Y
    const totalAchievedDelta = path.moves.reduce((sum, move) => sum + (move.prescribedDelta * move.coef), 0);
    const percentOfGoal = deltaY !== 0 ? Math.min(100, Math.max(0, (totalAchievedDelta / deltaY) * 100)) : 100;

    const badgeColorMap = {
        'combo_balanced': 'bg-purple-100 text-purple-700 border-purple-200',
        'combo_aggressive': 'bg-rose-100 text-rose-700 border-rose-200'
    };
    const strokeColorMap = {
        'combo_balanced': 'border-purple-500/30',
        'combo_aggressive': 'border-rose-500/30'
    };

    return (
        <div className={`bg-white p-5 rounded-xl border-2 shadow-sm transition-colors relative overflow-hidden ${strokeColorMap[path.type]}`}>
            <div className={`absolute top-0 right-0 px-3 py-1 text-xs font-black uppercase tracking-wider rounded-bl-lg ${badgeColorMap[path.type]}`}>
                Combination
            </div>
            <h4 className="text-sm font-bold text-slate-800 mt-2 mb-4">{path.title}</h4>

            <div className="space-y-4">
                {path.moves.map(move => {
                    const currentVal = parseFloat(financials[move.id]) || 0;
                    const newVal = currentVal + move.prescribedDelta;
                    return (
                        <div key={move.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between items-center text-slate-600 font-bold text-sm">
                                    <span>{formatLabel(move.id)}</span>
                                    <span className="text-blue-600">{move.prescribedDelta > 0 ? '+' : ''}{move.prescribedDelta.toFixed(2)} pts</span>
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium bg-blue-50/50 px-2 py-1 rounded border border-blue-50">
                                    Requires growing by <span className="font-bold text-blue-700">{calculateCagr(currentVal, newVal, timeHorizon).toFixed(2)}%</span> annually over {timeHorizon} years
                                </div>
                                <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 mt-1">
                                    <span>Cur: {currentVal.toFixed(2)}%</span>
                                    <span>Tgt: {newVal.toFixed(2)}%</span>
                                </div>
                            </div>
                        </div>
                    )
                })}

                <div className="w-full bg-slate-100 rounded-full h-2 flex overflow-hidden mt-4">
                    <div className={`h-2 rounded-full transition-all duration-300 ${percentOfGoal >= 100 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${Math.max(0, percentOfGoal)}%` }}></div>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-500 font-bold text-right pt-2 border-t border-slate-100">
                    <span className="w-full">Overall Goal: {percentOfGoal.toFixed(0)}% Achieved</span>
                </div>
            </div>
        </div>
    );
};

const SinglePathCard = ({ path, model, financials, deltaY, timeHorizon }) => {
    const leverName = path.id;
    const coef = path.coef;
    const currentVal = parseFloat(financials[leverName]) || 0;

    const [sliderDelta, setSliderDelta] = useState(path.prescribedDelta);
    useEffect(() => { Promise.resolve().then(() => setSliderDelta(path.prescribedDelta)); }, [path.prescribedDelta]);

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

    // Calculate arbitrary bounds for slider since 4q bounds were removed
    let minBound = -10;
    let maxBound = 10;
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

                <div className="flex justify-between items-center text-xs text-slate-500 font-bold border-b border-slate-100 pb-3 mb-2 border-dashed">
                    <span>Delta: {sliderDelta > 0 ? '+' : ''}{sliderDelta.toFixed(2)} pts</span>
                    <span>Achieves {percentOfGoal.toFixed(0)}% of Goal</span>
                </div>

                <div className="text-sm font-semibold text-blue-900 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100 flex items-center justify-between">
                    <span>Required Annual Growth:</span>
                    <span className="font-black text-blue-700">{calculateCagr(currentVal, newLeverVal, timeHorizon).toFixed(2)}% <span className="text-xs text-blue-500 font-medium">/yr</span></span>
                </div>

                <div className="pt-2 mt-2 grid grid-cols-2 gap-2">
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

const InteractivePathCard = ({ path, model, financials, deltaY, timeHorizon }) => {
    if (path.isCombo) {
        return <ComboPathCard path={path} financials={financials} deltaY={deltaY} timeHorizon={timeHorizon} />;
    }
    return <SinglePathCard path={path} model={model} financials={financials} deltaY={deltaY} timeHorizon={timeHorizon} />;
};

const StrategicPlannerTab = ({ financials, benchmarks, isPresentationMode }) => {
    const [model, setModel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [targetKpi, setTargetKpi] = useState('returnOnAssets');
    const [targetType, setTargetType] = useState('peer_median');
    const [timeHorizon, setTimeHorizon] = useState(3);

    // Calculated State
    const [paths, setPaths] = useState([]);
    const [gap, setGap] = useState(0);
    const [currentTarget, setCurrentTarget] = useState(0);
    const [currentValue, setCurrentValue] = useState(0);
    const [isOutperforming, setIsOutperforming] = useState(false);

    useEffect(() => {
        const fetchModel = async () => {
            try {
                // Use cached model JSON if available (avoids re-fetching on every bank switch)
                if (!_cachedModelJson) {
                    const response = await fetch('/models/whatwouldittake_tiered.json');
                    if (!response.ok) {
                        throw new Error('V3 Tiered model artifact missing. Run offline training pipeline.');
                    }
                    _cachedModelJson = await response.json();
                }
                const data = _cachedModelJson;

                // Validate schema version
                if (data.schema_version !== "3.0") {
                    throw new Error('Invalid model architecture. Expected schema_version 3.0.');
                }

                // Determine Bank's Tier based on ASSET (in thousands)
                const assets = parseFloat(financials?.raw?.ASSET || 0);
                let tierKey = '<$1B';
                if (assets > 250000000) tierKey = '>$250B';
                else if (assets > 100000000) tierKey = '$100B-$250B';
                else if (assets > 50000000) tierKey = '$50B-$100B';
                else if (assets > 10000000) tierKey = '$10B-$50B';
                else if (assets > 1000000) tierKey = '$1B-$10B';

                const selectedTierModel = data.tiers[tierKey];
                if (!selectedTierModel) {
                    throw new Error(`Model specifically trained for tier ${tierKey} is missing from artifact.`);
                }

                setModel({
                    ...selectedTierModel,
                    schema_version: data.schema_version,
                    trained_on: data.trained_on
                });
                setError(null);
            } catch (err) {
                console.error("Strategic Planner initialization failed:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (financials) {
            fetchModel();
        }
    }, [financials]);

    // Target Logic Helper
    const isBeatingMedian = useCallback(() => {
        if (!targetKpi || !financials || !benchmarks) return false;
        const currentVals = parseFloat(financials[targetKpi]);
        const medianVals = parseFloat(benchmarks[targetKpi]);
        if (isNaN(currentVals) || isNaN(medianVals)) return false;

        const lowerIsBetter = ['costOfFunds', 'efficiencyRatio', 'nptlRatio'].includes(targetKpi);
        return lowerIsBetter ? currentVals < medianVals : currentVals > medianVals;
    }, [targetKpi, financials, benchmarks]);

    // Auto-adjust targetType if bank is already beating median
    useEffect(() => {
        if (targetType === 'peer_median' && isBeatingMedian()) {
            setTargetType('peer_top_quartile');
        }
    }, [targetKpi, financials, benchmarks, targetType, isBeatingMedian]);

    // Pre-calculate which KPIs have mathematically viable paths or aren't already outperforming
    const availableKpis = useMemo(() => {
        if (!model || !financials || !benchmarks) return [];
        return ALL_KPIS.filter(kpi => {
            try {
                const targetKpiId = kpi.id;
                const cVal = parseFloat(financials[targetKpiId]);
                if (isNaN(cVal)) return false;

                let tVal;
                if (targetType === 'peer_median') {
                    tVal = parseFloat(benchmarks[targetKpiId]);
                } else if (targetType === 'peer_top_quartile') {
                    const lowerIsBetter = ['costOfFunds', 'efficiencyRatio', 'nptlRatio'].includes(targetKpiId);
                    tVal = lowerIsBetter ? parseFloat(benchmarks?.p25?.[targetKpiId]) : parseFloat(benchmarks?.p75?.[targetKpiId]);
                }
                if (isNaN(tVal)) return false;

                const lowerIsBetter = ['costOfFunds', 'efficiencyRatio', 'nptlRatio'].includes(targetKpiId);
                const beatingTarget = lowerIsBetter ? (cVal <= tVal) : (cVal >= tVal);
                if (beatingTarget) return false;

                const deltaY = tVal - cVal;
                const targetModel = model.targets[targetKpiId];
                if (!targetModel) return false;

                const activeLevers = model.features;
                let hasValidPath = false;

                for (let idx = 0; idx < activeLevers.length; idx++) {
                    const leverName = activeLevers[idx];
                    const coef = targetModel.coef[idx];
                    if (Math.abs(coef) < 0.0001) continue;

                    let requiredMove = deltaY / coef;

                    const shouldBePositive = ['yieldOnLoans', 'nonInterestIncomePercent'].includes(leverName);
                    const shouldBeNegative = ['costOfFunds', 'efficiencyRatio', 'nptlRatio'].includes(leverName);

                    if (shouldBePositive && requiredMove < 0) continue;
                    if (shouldBeNegative && requiredMove > 0) continue;

                    const currentVal = parseFloat(financials[leverName]) || 0;
                    const newVal = currentVal + requiredMove;
                    if (leverName === 'costOfFunds' && newVal < 0.05) continue;
                    if (leverName === 'yieldOnLoans' && newVal > 25.0) continue;
                    if (leverName === 'efficiencyRatio' && newVal < 30.0) continue;

                    hasValidPath = true; // At least one path works physically
                    break;
                }

                return hasValidPath;
            } catch {
                return false;
            }
        });
    }, [model, financials, benchmarks, targetType]);

    // Auto-select valid KPI if selected is not allowed
    useEffect(() => {
        if (availableKpis.length > 0 && !availableKpis.find(k => k.id === targetKpi)) {
            setTargetKpi(availableKpis[0].id);
        }
    }, [availableKpis, targetKpi]);

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
            // For ALL metrics, deltaY is what we need to ADD to current to get to target.
            const deltaY = tVal - cVal;
            setGap(deltaY);

            const lowerIsBetter = ['costOfFunds', 'efficiencyRatio', 'nptlRatio'].includes(targetKpi);

            // Beating Target logic is correct here:
            // If lower is better, we are beating it if current <= target (current 1.0 vs target 1.5)
            // If higher is better, we are beating it if current >= target (current 1.5 vs target 1.0)
            const beatingTarget = lowerIsBetter ? (cVal <= tVal) : (cVal >= tVal);
            setIsOutperforming(beatingTarget);

            if (beatingTarget) {
                setPaths([]);
                return;
            }

            // 2. Generate Paths
            const targetModel = model.targets[targetKpi];
            if (!targetModel) throw new Error(`No trained model for target: ${targetKpi}`);

            const newPaths = [];
            const activeLevers = model.features;

            const createSingleLeverPath = (leverIdx, name, type) => {
                const leverName = activeLevers[leverIdx];
                const coef = targetModel.coef[leverIdx];

                if (Math.abs(coef) < 0.0001) return null; // Lever has no effect

                let requiredMove = deltaY / coef;

                // "Do No Harm" Banking Logic Check
                const shouldBePositive = ['yieldOnLoans', 'nonInterestIncomePercent'].includes(leverName);
                const shouldBeNegative = ['costOfFunds', 'efficiencyRatio', 'nptlRatio'].includes(leverName);

                if (shouldBePositive && requiredMove < 0) return null;
                if (shouldBeNegative && requiredMove > 0) return null;

                // "Real World Physical Limits"
                const currentVal = parseFloat(financials[leverName]) || 0;
                const newVal = currentVal + requiredMove;
                if (leverName === 'costOfFunds' && newVal < 0.05) return null;
                if (leverName === 'yieldOnLoans' && newVal > 25.0) return null;
                if (leverName === 'efficiencyRatio' && newVal < 30.0) return null;

                return {
                    id: leverName,
                    type: type,
                    title: `Adjust ${formatLabel(leverName)}`,
                    prescribedDelta: requiredMove,
                    coef: coef,
                    idx: leverIdx,
                    isCombo: false
                };
            };

            // 1. Find all mathematically valid, "Do No Harm" levers
            const validLevers = [];
            activeLevers.forEach((lever, idx) => {
                const path = createSingleLeverPath(idx, "", "");
                if (path) {
                    validLevers.push(path);
                }
            });

            // Sort by absolute strength (most powerful first)
            validLevers.sort((a, b) => Math.abs(b.coef) - Math.abs(a.coef));

            // Generate Single Paths
            if (validLevers.length > 0) {
                const pathA = { ...validLevers[0], title: `Primary Driver`, type: 'primary' };
                newPaths.push(pathA);
            }
            if (validLevers.length > 1) {
                const pathB = { ...validLevers[1], title: `Secondary Driver`, type: 'secondary' };
                newPaths.push(pathB);
            }

            // Generate Combination Paths if we have multiple valid levers
            if (validLevers.length > 1) {
                // Determine realistic caps dynamically based on confidence P10/P90 or fallback empirical limits
                // For combination paths, we just spread the required deltaY

                // Balanced Path: Spread deltaY evenly across all valid levers
                const balancedShare = deltaY / validLevers.length;
                const balancedMoves = validLevers.map(lv => {
                    return {
                        id: lv.id,
                        coef: lv.coef,
                        prescribedDelta: balancedShare / lv.coef
                    };
                });

                newPaths.push({
                    id: 'combo_balanced',
                    type: 'combo_balanced',
                    title: 'Balanced Approach',
                    isCombo: true,
                    moves: balancedMoves
                });

                // Aggressive Path: 60% top lever, 40% second lever (only if 2+ exist)
                if (validLevers.length >= 2) {
                    const topLever = validLevers[0];
                    const secondLever = validLevers[1];
                    const moves = [
                        { id: topLever.id, coef: topLever.coef, prescribedDelta: (deltaY * 0.6) / topLever.coef },
                        { id: secondLever.id, coef: secondLever.coef, prescribedDelta: (deltaY * 0.4) / secondLever.coef }
                    ];

                    newPaths.push({
                        id: 'combo_aggressive',
                        type: 'combo_aggressive',
                        title: 'Aggressive 60/40 Split',
                        isCombo: true,
                        moves: moves
                    });
                }
            }

            setPaths(newPaths);

        } catch (err) {
            console.error("Error solving scenario:", err);
            // Non-fatal, just clear paths
            setPaths([]);
        }
    }, [model, financials, benchmarks, targetKpi, targetType]);

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

    // Stub UI for V1 Layout
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {!isPresentationMode && (
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
                            Model Version: {model.schema_version} (as of {new Date(model.trained_on.asof).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})
                        </div>
                    )}
                </div>
            )}

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
                                    {availableKpis.map(kpi => (
                                        <option key={kpi.id} value={kpi.id}>{kpi.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Target Type</label>
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none disabled:opacity-50"
                                    value={targetType}
                                    onChange={(e) => setTargetType(e.target.value)}
                                >
                                    <option value="peer_median" disabled={isBeatingMedian()}>
                                        {isBeatingMedian() ? `Peer Median (Already Beating)` : `Peer Median`}
                                    </option>
                                    <option value="peer_top_quartile">Top Quartile (75th)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                    </svg>
                                    Scenario Horizon
                                </label>
                                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                                    {[1, 3, 5].map(years => (
                                        <button
                                            key={years}
                                            onClick={() => setTimeHorizon(years)}
                                            className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-all ${timeHorizon === years
                                                ? 'bg-white text-blue-900 shadow-sm border border-slate-200'
                                                : 'text-slate-500 hover:text-blue-700'
                                                }`}
                                        >
                                            {years} Yr{years > 1 ? 's' : ''}
                                        </button>
                                    ))}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

                {availableKpis.length === 0 ? (
                    <div className="md:col-span-8 space-y-6">
                        <div className="bg-emerald-50 py-16 px-8 rounded-xl border border-emerald-100 flex flex-col items-center justify-center text-center h-full">
                            <span className="text-6xl mb-6 drop-shadow-sm">🏆</span>
                            <h3 className="text-2xl font-black text-emerald-800 mb-3 tracking-tight">Maximum Outperformance Achieved</h3>
                            <p className="text-emerald-700 max-w-lg mb-6 leading-relaxed">
                                Your bank is currently outperforming all available benchmark targets, or there are no remaining mathematically viable constraints left to pull.
                            </p>
                            <span className="bg-emerald-200/50 text-emerald-900 font-bold px-4 py-2 rounded-full text-sm border border-emerald-300">
                                Excellent Standing Among Peers
                            </span>
                        </div>
                    </div>
                ) : (
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
                                    <span className={`px-2 py-0.5 rounded font-bold text-sm ${isOutperforming ? 'bg-emerald-100 text-emerald-700' :
                                        gap !== 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                                        }`}>
                                        {gap > 0 ? '+' : ''}{gap.toFixed(2)}%
                                    </span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target ({targetType.replaceAll('_', ' ')})</span>
                                    <span className="text-xl font-black text-blue-900">{currentTarget.toFixed(2)}%</span>
                                </div>
                            </div>

                            {/* Stubs for paths */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {isOutperforming ? (
                                    <div className="col-span-2 text-center py-10 bg-emerald-50 rounded-xl border-2 border-emerald-100 flex flex-col items-center justify-center">
                                        <span className="text-4xl mb-3">🏆</span>
                                        <h4 className="text-emerald-800 font-black text-lg">Goal Achieved</h4>
                                        <p className="text-emerald-600 font-bold text-sm mt-1">You are already outperforming the set target.</p>
                                    </div>
                                ) : paths.length === 0 ? (
                                    <div className="col-span-2 text-center py-8 text-sm text-slate-500 bg-white rounded-lg border border-dashed border-slate-300">
                                        <p className="font-bold text-slate-700 mb-1">Constrained by Market Reality</p>
                                        <p>The Scenario Engine cannot find a mathematically viable path to achieve this target without breaking core physical constraints (e.g. lowering Cost of Funds below 0.05% or increasing Yield to extreme levels).</p>
                                    </div>
                                ) : (
                                    paths.map((path) => (
                                        <InteractivePathCard
                                            key={path.id}
                                            path={path}
                                            model={model}
                                            financials={financials}
                                            deltaY={gap}
                                            timeHorizon={timeHorizon}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="text-center text-xs text-slate-400 font-bold max-w-2xl mx-auto mt-8">
                Disclaimer: Scenarios are based on historical peer movements and ridge regression models. Not financial advice. Always consult your ALM model.
            </div>
        </div>
    );
};

export default StrategicPlannerTab;
