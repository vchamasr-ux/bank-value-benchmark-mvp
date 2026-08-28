import React, { useState } from 'react';
import TrendSparkline from './TrendSparkline';

const TrendIndicator = ({ history, metric, inverse }) => {
    const [isHovered, setIsHovered] = useState(false);

    if (!history || history.length < 2) return null;

    // Get latest and previous values (assuming history[0] is latest)
    // History is desc by date: [Q4, Q3, Q2, Q1]
    const current = parseFloat(history[0][metric]) || 0;

    // Find previous quarter (next in array)
    const previous = parseFloat(history[1][metric]) || 0;

    if (previous === 0 && current === 0) return null;

    // All KPIs in this application are already expressed as whole numbers representing percentages.
    // Calculating relative percentage change `((current - previous) / previous)` against rates
    // generates extreme mathematically valid but practically meaningless numbers (e.g. 0.1% -> 1.0% = +900%).
    // We instead calculate the flat nominal percentage point difference.
    const nominalDiff = current - previous;
    const absChange = Math.abs(nominalDiff);

    // Determine Color Logic
    // Default: Increase is Green (Good), Decrease is Red (Bad)
    // Inverse: Increase is Red (Bad e.g. Expenses), Decrease is Green (Good)
    let isPositive = nominalDiff > 0;
    let isGood = isPositive;

    if (inverse) {
        isGood = !isPositive;
    }

    const colorClass = isGood ? 'text-green-600' : 'text-red-600';
    const arrow = isPositive ? '↗' : '↘';

    return (
        <div
            className="relative inline-flex items-center ml-2 cursor-help"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <span className={`text-xs font-medium ${colorClass} flex items-center`}>
                {arrow} {absChange.toFixed(1)}%
            </span>

            {/* Hover Sparkline Tooltip */}
            {isHovered && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white p-2 rounded shadow-xl border border-gray-100 z-50 w-32">
                    <TrendSparkline data={history} metric={metric} inverse={inverse} />
                </div>
            )}
        </div>
    );
};

export default TrendIndicator;
