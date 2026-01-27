import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

// Helper for range calculations to support Testing
export const calculateGaugeRanges = ({ value, min = 0, max = 100, average, p25, p75, inverse = false }) => {
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
        ? ['#22c55e', '#eab308', '#ef4444'] // Green -> Yellow -> Red
        : ['#ef4444', '#eab308', '#22c55e']; // Red -> Yellow -> Green

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
            { name: inverse ? 'Top Q' : 'Bottom Q', value: q1 - vMin, color: colors[0] },
            { name: 'Middle 50%', value: q3 - q1, color: colors[1] },
            { name: inverse ? 'Bottom Q' : 'Top Q', value: vMax - q3, color: colors[2] }
        ];

        // Return early with new bounds (No ticks needed when sectors match quartiles)
        return { ranges, visualMin: vMin, visualMax: vMax, p25Angle: null, p75Angle: null };
    }

    // METHOD 1: Default Equal Sectors (Fallback)
    const sectorWidth = totalVisualRange / 3;

    ranges = [
        { name: 'Low', value: sectorWidth, color: colors[0] },
        { name: 'Mid', value: sectorWidth, color: colors[1] },
        { name: 'High', value: sectorWidth, color: colors[2] },
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


const GaugeChart = ({ value, min = 0, max = 100, label, average, p25, p75, inverse = false, suffix = "%" }) => {
    // Calculate ranges and the visual bounds used for them
    const { ranges, visualMin, visualMax, p25Angle, p75Angle } = calculateGaugeRanges({ value, min, max, average, p25, p75, inverse });

    // Format helper
    const format = (v) => {
        if (v === undefined || v === null) return "";
        const formattedNum = typeof v === 'number' ? v.toFixed(2) : v;
        return `${formattedNum}${suffix}`;
    };

    // Normalize value for the needle rotation
    // We must clamp the value to the visual range we defined, otherwise the needle spins 360
    const clampedValue = Math.min(Math.max(value, visualMin), visualMax);
    const range = visualMax - visualMin;
    const percentage = (clampedValue - visualMin) / range;
    const rotation = (percentage * 180) - 90;

    return (
        <div className="flex flex-col items-center">
            <div className="relative w-48 h-24">
                <PieChart width={192} height={96}>
                    <Pie
                        data={ranges}
                        cx="50%"
                        cy="100%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={0}
                        dataKey="value"
                        stroke="none"
                    >
                        {ranges.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip
                        formatter={() => ''}
                        separator=""
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                    <div className="bg-white p-2 border border-gray-200 shadow-lg rounded text-xs">
                                        <span className="font-bold" style={{ color: data.color }}>{data.name}</span>
                                        {p25 && p75 && (
                                            <div className="text-gray-500 mt-1">
                                                {data.name.includes('Low') || data.name.includes('Bottom') ? `Below ${format(p25)}` : ''}
                                                {data.name.includes('Mid') || data.name.includes('Middle') ? `${format(p25)} - ${format(p75)}` : ''}
                                                {data.name.includes('High') || data.name.includes('Top') ? `Above ${format(p75)}` : ''}
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

                {/* Needle */}
                <div
                    className="absolute bottom-0 left-1/2 w-1 h-20 origin-bottom bg-gray-800 transition-transform duration-1000 ease-out"
                    style={{
                        transform: `translateX(-50%) rotate(${rotation}deg)`
                    }}
                ></div>
                <div className="absolute bottom-0 left-1/2 w-4 h-4 -ml-2 -mb-2 rounded-full bg-gray-800"></div>
            </div>

            <div className="text-center mt-2 w-full">
                <h3 className="text-sm font-medium text-gray-500 uppercase">{label}</h3>
                <div className="text-2xl font-bold text-gray-800">
                    {typeof value === 'number' ? value.toFixed(2) : value}{suffix}
                </div>

                {(average !== undefined && average !== null) && (
                    <div className="text-xs text-gray-400 mt-1 flex flex-col items-center w-full">
                        <span className="font-semibold">Avg: {format(average)}</span>
                        {p25 && p75 && (
                            <div className="flex gap-2 mt-0.5 text-[10px] text-gray-500">
                                <span>P25: {format(p25)}</span>
                                <span>P75: {format(p75)}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GaugeChart;
