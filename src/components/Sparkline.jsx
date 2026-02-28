import React from 'react';

const Sparkline = ({ value, min = 0, max = 100, average, inverse = false, suffix = "%", label }) => {
    // Similar math to GaugeChart, but linear
    const range = max - min;
    const clampedValue = Math.min(Math.max(value, min), max);
    const valuePercent = ((clampedValue - min) / range) * 100;

    let avgPercent = null;
    if (average !== undefined && average !== null) {
        const clampedAvg = Math.min(Math.max(average, min), max);
        avgPercent = ((clampedAvg - min) / range) * 100;
    }

    // Determine color based on value vs. average and inverse logic
    let fillClass = "bg-blue-500";
    if (avgPercent !== null) {
        const isBetter = inverse ? value <= average : value >= average;
        fillClass = isBetter ? "bg-green-500" : "bg-red-500";
    }

    return (
        <div className="w-full max-w-xs flex flex-col gap-1 mt-2">
            {label && (
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {label}
                </div>
            )}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    {/* Value Bar */}
                    <div
                        className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${fillClass}`}
                        style={{ width: `${valuePercent}%` }}
                    />
                    {/* Average Marker */}
                    {avgPercent !== null && (
                        <div
                            className="absolute top-0 bottom-0 w-1 bg-slate-800 z-10"
                            style={{ left: `calc(${avgPercent}% - 2px)` }}
                            title={`Peer Average: ${average}${suffix}`}
                        />
                    )}
                </div>
                <div className="text-sm font-black text-slate-800 whitespace-nowrap min-w-[3rem] text-right">
                    {value}{suffix}
                </div>
            </div>
            {avgPercent !== null && (
                <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                    <span>{min}{suffix}</span>
                    <span>Peer Avg: {average}{suffix}</span>
                    <span>{max}{suffix}</span>
                </div>
            )}
        </div>
    );
};

export default Sparkline;
