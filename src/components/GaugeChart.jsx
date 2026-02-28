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
const calculateGaugeRanges = ({ value, min = 0, max = 100, average, p25, p75, inverse = false }) => {
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
        ? ['#10B981', '#F59E0B', '#F43F5E'] // Emerald 500, Amber 500, Rose 500
        : ['#F43F5E', '#F59E0B', '#10B981']; // Rose 500, Amber 500, Emerald 500

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


const GaugeChart = ({ value, min = 0, max = 100, label, average, p25, p75, inverse = false, suffix = "%", trend, metric, isActive = true }) => {
    // Animate needle sweep: starts at far-left (-90°) and transitions to real rotation when active/scrolled
    const [animated, setAnimated] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!isActive) {
            setAnimated(false);
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
    const { ranges, visualMin, visualMax, p25Angle, p75Angle } = calculateGaugeRanges({ value, min, max, average, p25, p75, inverse });

    // Format helper
    const format = (v) => {
        if (v === undefined || v === null) return "";
        const formattedNum = typeof v === 'number' ? v.toFixed(2) : v;
        return `${formattedNum}${suffix}`;
    };

    const isAvailable = value !== undefined && value !== null && !isNaN(value);

    // Normalize value for the needle rotation
    // We must clamp the value to the visual range we defined, otherwise the needle spins 360
    const clampedValue = isAvailable ? Math.min(Math.max(value, visualMin), visualMax) : visualMin;
    const range = visualMax - visualMin;
    const percentage = isAvailable && range ? (clampedValue - visualMin) / range : 0;
    const rotation = (percentage * 180) - 90;

    return (
        <div ref={containerRef} className={`flex flex-col items-center flex-1 w-full bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 transition-all hover:shadow-md h-full relative z-10 ${!isAvailable ? 'opacity-80 grayscale-[0.2]' : ''}`}>
            <div className="relative w-48 h-24 mt-2">
                <PieChart width={192} height={96}>
                    <Pie
                        data={ranges}
                        cx="50%"
                        cy="100%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius={72}
                        outerRadius={80}
                        paddingAngle={0}
                        dataKey="value"
                        stroke="none"
                    >
                        {ranges.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <RechartsTooltip
                        wrapperStyle={{ zIndex: 100 }} // Ensure tooltip is on top
                        formatter={() => ''}
                        separator=""
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                    <div className="bg-white p-2 border border-blue-100 shadow-xl rounded text-xs z-50">
                                        <span className="font-bold" style={{ color: data.color }}>{data.name}</span>
                                        {p25 && p75 && (
                                            <div className="text-gray-500 mt-1">
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

                {/* Needle - sweeps from -90° (far left) to real rotation when isActive */}
                <div
                    className={`absolute bottom-0 left-1/2 w-[2px] h-[75px] origin-bottom transition-transform duration-[1200ms] ease-out pointer-events-none rounded-t-full ${isAvailable ? 'bg-slate-600' : 'bg-slate-300'}`}
                    style={{
                        transform: `translateX(-50%) rotate(${animated ? rotation : -90}deg)`
                    }}
                ></div>
                <div className={`absolute bottom-0 left-1/2 w-2.5 h-2.5 -ml-[5px] -mb-[5px] rounded-full pointer-events-none shadow-sm ${isAvailable ? 'bg-slate-700' : 'bg-slate-300'}`}></div>
            </div>

            <div className="text-center mt-2 w-full">
                <Tooltip content={METRIC_DEFINITIONS[metric]} position="bottom">
                    <h3 className="text-sm font-medium text-gray-500 uppercase cursor-help hover:text-gray-800 transition-colors border-b border-dashed border-gray-300 inline-block p-1">{label}</h3>
                </Tooltip>
                <div className="flex justify-center items-center mt-2.5">
                    <div className={`text-2xl font-extrabold tracking-tight ${isAvailable ? 'text-slate-800' : 'text-slate-400'}`}>
                        {isAvailable ? `${typeof value === 'number' ? value.toFixed(2) : value}${suffix}` : 'N/A'}
                    </div>
                    {/* Render Subtle Trend Indicator if history is available */}
                    {trend && metric && isAvailable && (
                        <TrendIndicator history={trend} metric={metric} inverse={inverse} />
                    )}
                </div>

                {(average !== undefined && average !== null) && (
                    <div className="text-xs text-gray-400 mt-1 flex flex-col items-center w-full">
                        <span className="font-semibold">Avg: {format(average)}</span>
                        {p25 != null && p75 != null && (() => {
                            const q1 = Number(p25), q3 = Number(p75), iqr = (q3 - q1) || 0.0001;
                            const v = Number(value);
                            let pct;
                            if (v <= q1) pct = Math.round(25 * Math.max(0, (v - (q1 - iqr)) / iqr));
                            else if (v <= q3) pct = Math.round(25 + 50 * ((v - q1) / iqr));
                            else pct = Math.round(75 + 25 * Math.min(1, (v - q3) / iqr));
                            pct = Math.max(1, Math.min(99, pct));
                            const clr = inverse
                                ? (pct <= 33 ? 'text-emerald-600' : pct <= 66 ? 'text-amber-500' : 'text-rose-600')
                                : (pct >= 67 ? 'text-emerald-600' : pct >= 34 ? 'text-amber-500' : 'text-rose-600');
                            return (
                                <span className={`text-[11px] font-bold mt-0.5 ${clr}`} title="Estimated percentile rank within peer group">
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
