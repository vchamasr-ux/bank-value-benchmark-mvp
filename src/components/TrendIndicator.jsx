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

    if (previous === 0) return null; // Avoid division by zero

    const percentChange = ((current - previous) / previous) * 100;
    const absChange = Math.abs(percentChange);

    // Determine Color Logic
    // Default: Increase is Green (Good), Decrease is Red (Bad)
    // Inverse: Increase is Red (Bad e.g. Expenses), Decrease is Green (Good)
    let isPositive = percentChange > 0;
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
                    <div className="text-[10px] text-gray-500 text-center mb-1">4-Q Trend</div>
                    <TrendSparkline data={history} metric={metric} inverse={inverse} />
                </div>
            )}
        </div>
    );
};

export default TrendIndicator;
