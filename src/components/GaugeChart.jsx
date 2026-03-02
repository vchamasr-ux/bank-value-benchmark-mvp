import React, { useState, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import TrendIndicator from './TrendIndicator';
import Tooltip from './Tooltip';

const METRIC_DEFINITIONS = {
    returnOnEquity: "Net Income divided by Average Total Equity. Measures how effectively management is using a company's assets to create profits.",
    returnOnAssets: "Net Income divided by Average Total Assets. Shows how profitable a company is relative to its total assets.",
    efficiencyRatio: "Non-Interest Expense divided by (Net Interest Income + Non-Interest Income). A lower number means better cost control.",
    netInterestMargin: "(Interest Income - Interest Expense) divided by Average Earning Assets. Core indicator of lending profitability.",
    assetGrowth3Y: "Compound Annual Growth Rate of Total Assets over the last 3 years.",
    nptlRatio: "Non-Performing Loans divided by Total Loans. Indicates the quality of the loan portfolio (lower is better)."
};

// Helper for range calculations to support Testing
const calculateGaugeRanges = ({ min = 0, max = 100, average, p25, p75, inverse = false }) => {
    // Strategy: Center the gauge around the Average value.
    // Determine the Visual Range such that Average is exactly in the middle.

    // Default fallback if no average
    const effectiveAverage = (average !== undefined && average !== null) ? average : (min + max) / 2;

    // Determine the max distance from average to either boundary
    const distMin = Math.abs(effectiveAverage - min);
    const distMax = Math.abs(max - effectiveAverage);
    const delta = Math.max(distMin, distMax) || 1;
    const visualDelta = delta * 1.1;

    // Default Visual Bounds (Center-based)
    let visualMin = effectiveAverage - visualDelta;
    let visualMax = effectiveAverage + visualDelta;
    let totalVisualRange = visualMax - visualMin;

    const colors = inverse
        ? ['#34D399', '#FBBF24', '#FB7185'] // Emerald 400, Amber 400, Rose 400
        : ['#FB7185', '#FBBF24', '#34D399']; // Rose 400, Amber 400, Emerald 400

    let ranges = [];
    let p25Angle = null;
    let p75Angle = null;

    // METHOD 2: Quartile-Based Zones (Distribution-Aware)
    if (p25 !== undefined && p75 !== undefined && p25 !== null && p75 !== null) {
        const q1 = Number(p25);
        const q3 = Number(p75);
        const iqr = q3 - q1;
        const padding = Math.max(iqr * 0.5, (max - min) * 0.1) || 1;

        // Override visual bounds for this mode
        const vMin = Math.min(min, q1 - padding);
        const vMax = Math.max(max, q3 + padding);

        ranges = [
            { name: inverse ? 'Top Q' : 'Bottom Q', value: q1 - vMin, color: colors[0], type: 'low' },
            { name: 'Middle 50%', value: q3 - q1, color: colors[1], type: 'mid' },
            { name: inverse ? 'Bottom Q' : 'Top Q', value: vMax - q3, color: colors[2], type: 'high' }
        ];

        // Return early with new bounds (No ticks needed when sectors match quartiles)
        return { ranges, visualMin: vMin, visualMax: vMax, p25Angle: null, p75Angle: null };
    }

    // METHOD 1: Default Equal Sectors (Fallback)
    const sectorWidth = totalVisualRange / 3;

    ranges = [
        { name: 'Low', value: sectorWidth, color: colors[0], type: 'low' },
        { name: 'Mid', value: sectorWidth, color: colors[1], type: 'mid' },
        { name: 'High', value: sectorWidth, color: colors[2], type: 'high' },
    ];

    // Method 1 Ticks
    if (p25 !== undefined && p75 !== undefined) {
        const p25Clamped = Math.min(Math.max(p25, visualMin), visualMax);
        const p75Clamped = Math.min(Math.max(p75, visualMin), visualMax);

        const p25Percent = (p25Clamped - visualMin) / totalVisualRange;
        const p75Percent = (p75Clamped - visualMin) / totalVisualRange;

        p25Angle = (p25Percent * 180) - 90;
        p75Angle = (p75Percent * 180) - 90;
    }

    return { ranges, visualMin, visualMax, p25Angle, p75Angle };
};


const GaugeChart = ({ value, secondaryValue, min = 0, max = 100, label, average, p25, p75, inverse = false, suffix = "%", trend, metric, isActive = true, isLightMode = false }) => {
    // Animate needle sweep: starts at far-left (-90°) and transitions to real rotation when active/scrolled
    const [animated, setAnimated] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!isActive) {
            Promise.resolve().then(() => setAnimated(false));
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setAnimated(false);
                    requestAnimationFrame(() => {
                        setTimeout(() => setAnimated(true), 50);
                    });
                    if (containerRef.current) {
                        observer.unobserve(containerRef.current);
                    }
                }
            },
            { threshold: 0.1 }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, [isActive]);
    // Calculate ranges and the visual bounds used for them
    const { ranges, visualMin, visualMax, p25Angle, p75Angle } = calculateGaugeRanges({ min, max, average, p25, p75, inverse });

    // Format helper
    const format = (v) => {
        if (v === undefined || v === null) return "";
        let formattedNum = v;
        if (typeof v === 'number') {
            formattedNum = v.toFixed(2);
        } else if (typeof v === 'string' && !isNaN(parseFloat(v))) {
            formattedNum = parseFloat(v).toFixed(2);
        }
        return `${formattedNum}${suffix}`;
    };

    const isAvailable = value !== undefined && value !== null && !isNaN(value);

    // Normalize value for the needle rotation
    // We must clamp the value to the visual range we defined, otherwise the needle spins 360
    const clampedValue = isAvailable ? Math.min(Math.max(value, visualMin), visualMax) : visualMin;
    const range = visualMax - visualMin;
    const percentage = isAvailable && range ? (clampedValue - visualMin) / range : 0;
    const rotation = (percentage * 180) - 90;

    const isSecondaryAvailable = secondaryValue !== undefined && secondaryValue !== null && !isNaN(secondaryValue);
    const clampedSecondaryValue = isSecondaryAvailable ? Math.min(Math.max(secondaryValue, visualMin), visualMax) : visualMin;
    const secondaryPercentage = isSecondaryAvailable && range ? (clampedSecondaryValue - visualMin) / range : 0;
    const secondaryRotation = (secondaryPercentage * 180) - 90;

    return (
        <div ref={containerRef} className={`group flex flex-col items-center flex-1 w-full relative z-10 ${!isAvailable ? 'opacity-80 grayscale-[0.2]' : ''}`}>
            {/* Label has been moved down below the gauge in the mock, or we can keep it subtle above */}
            <div className="text-center w-full mb-1">
                <Tooltip content={METRIC_DEFINITIONS[metric]} position="top">
                    <h3 className={`text-sm font-semibold uppercase cursor-help transition-colors inline-block p-1 tracking-wider ${isLightMode ? 'text-slate-400 hover:text-slate-800' : 'text-slate-300 hover:text-white'}`}>{label}</h3>
                </Tooltip>
            </div>

            <div className="relative w-48 h-24 mt-2 mb-2">
                <PieChart width={192} height={96}>
                    <defs>
                        <filter id="gauge-shadow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="4" stdDeviation="5" floodOpacity="0.2" floodColor="#000000" />
                        </filter>
                    </defs>
                    <Pie
                        data={ranges}
                        cx="50%"
                        cy="100%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius={50} // Made thicker (was 72)
                        outerRadius={80}
                        paddingAngle={0}
                        dataKey="value"
                        stroke="none"
                    >
                        {ranges.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} style={{ filter: 'url(#gauge-shadow)' }} />
                        ))}
                    </Pie>
                    <RechartsTooltip
                        wrapperStyle={{ zIndex: 100 }}
                        formatter={() => ''}
                        separator=""
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                    <div className="bg-slate-800 p-2 border border-slate-600 shadow-xl rounded text-xs z-50 text-white font-sans">
                                        <span className="font-bold" style={{ color: data.color }}>{data.name}</span>
                                        {p25 && p75 && (
                                            <div className="text-slate-400 mt-1">
                                                {data.type === 'low' ? `Below ${format(p25)}` : ''}
                                                {data.type === 'mid' ? `${format(p25)} - ${format(p75)}` : ''}
                                                {data.type === 'high' ? `Above ${format(p75)}` : ''}
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                </PieChart>

                {/* Quartile Markers (if available, mostly Method 1) */}
                {p25Angle !== null && (
                    <div
                        className="absolute bottom-0 left-1/2 w-0.5 h-6 origin-bottom bg-gray-400 opacity-80"
                        style={{
                            transform: `translateX(-50%) rotate(${p25Angle}deg) translateY(-60px)`
                        }}
                        title={`P25: ${format(p25)}`}
                    ></div>
                )}
                {p75Angle !== null && (
                    <div
                        className="absolute bottom-0 left-1/2 w-0.5 h-6 origin-bottom bg-gray-400 opacity-80"
                        style={{
                            transform: `translateX(-50%) rotate(${p75Angle}deg) translateY(-60px)`
                        }}
                        title={`P75: ${format(p75)}`}
                    ></div>
                )}

                {/* Secondary Needle */}
                {isSecondaryAvailable && (
                    <>
                        <div
                            className={`absolute bottom-0 left-1/2 w-[3px] h-[75px] origin-bottom transition-transform duration-[1200ms] ease-out pointer-events-none rounded-t-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)] opacity-90`}
                            style={{
                                transform: `translateX(-50%) rotate(${animated ? secondaryRotation : -90}deg)`
                            }}
                        ></div>
                        <div className={`absolute bottom-[2px] left-1/2 w-3.5 h-3.5 -ml-[7px] -mb-[7px] rounded-full pointer-events-none shadow-[0_0_10px_rgba(192,132,252,0.9)] bg-purple-400`}></div>
                    </>
                )}

                {/* Main Needle */}
                <div
                    className={`absolute bottom-0 left-1/2 w-[4px] h-[70px] origin-bottom transition-transform duration-[1200ms] ease-out pointer-events-none rounded-t-full ${isAvailable ? (isLightMode ? 'bg-slate-800 shadow' : 'bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]') : 'bg-slate-500'}`}
                    style={{
                        transform: `translateX(-50%) rotate(${animated ? rotation : -90}deg)`
                    }}
                ></div>
                <div className={`absolute bottom-[-1px] left-1/2 w-[18px] h-[18px] -ml-[9px] -mb-[9px] rounded-full pointer-events-none border-[3px] border-[#0B1120] ${isAvailable ? (isLightMode ? 'bg-slate-800' : 'bg-white shadow-[0_0_15px_rgba(255,255,255,1)]') : 'bg-slate-500'}`}></div>
            </div>

            <div className="text-center mt-2 w-full">
                <div className="flex justify-center items-center mt-1">
                    <div className={`text-3xl font-extrabold tracking-wide ${isAvailable ? (isLightMode ? 'text-slate-800' : 'text-white drop-shadow-sm') : 'text-slate-600'}`} style={isLightMode ? {} : { textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
                        {isAvailable ? `${typeof value === 'number' ? value.toFixed(2) : parseFloat(value).toFixed(2) || value}${suffix}` : 'N/A'}
                    </div>
                    {/* Render Subtle Trend Indicator if history is available */}
                    {trend && metric && isAvailable && (
                        <div className="ml-2">
                            <TrendIndicator history={trend} metric={metric} inverse={inverse} />
                        </div>
                    )}
                </div>

                {/* Secondary Value Display */}
                {isSecondaryAvailable && (
                    <div className="flex items-center justify-center gap-1.5 mt-1.5" title="Secondary comparison bank value">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_5px_rgba(192,132,252,0.8)]"></span>
                        <span className="text-sm font-bold text-purple-300 tracking-wide">
                            {typeof secondaryValue === 'number' ? secondaryValue.toFixed(2) : parseFloat(secondaryValue).toFixed(2) || secondaryValue}{suffix}
                        </span>
                    </div>
                )}

                {(average !== undefined && average !== null) && (
                    <div className="text-xs text-slate-400 mt-2 flex flex-col items-center w-full">
                        <span className="font-semibold tracking-wide">Avg: {format(average)}</span>
                        {p25 != null && p75 != null && (() => {
                            const q1 = Number(p25), q3 = Number(p75), iqr = (q3 - q1) || 0.0001;
                            const v = Number(value);
                            let pct;
                            if (v <= q1) pct = Math.round(25 * Math.max(0, (v - (q1 - iqr)) / iqr));
                            else if (v <= q3) pct = Math.round(25 + 50 * ((v - q1) / iqr));
                            else pct = Math.round(75 + 25 * Math.min(1, (v - q3) / iqr));
                            pct = Math.max(1, Math.min(99, pct));
                            const clr = inverse
                                ? (pct <= 33 ? 'text-emerald-400' : pct <= 66 ? 'text-amber-400' : 'text-rose-400')
                                : (pct >= 67 ? 'text-emerald-400' : pct >= 34 ? 'text-amber-400' : 'text-rose-400');
                            return (
                                <span className={`text-[11px] font-bold mt-1 ${clr}`} title="Estimated percentile rank within peer group">
                                    {pct}th pct of peers
                                </span>
                            );
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GaugeChart;

