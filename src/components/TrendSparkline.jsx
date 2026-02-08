import React from 'react';
import { LineChart, Line, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

const TrendSparkline = ({ data, metric, inverse }) => {
    if (!data || data.length < 2) return null;

    // Data is passed in DESC order (Newest First). Reverse for Chart (Oldest First).
    // Take only the last 4 points (most recent year)
    const chartData = [...data].slice(0, 4).reverse().map(d => ({
        name: d.reportDate,
        value: parseFloat(d[metric]) || 0
    }));

    // Determine Trend Color
    const first = chartData[0]?.value || 0;
    const last = chartData[chartData.length - 1]?.value || 0;

    let color = '#9ca3af'; // Gray default
    if (chartData.length > 1) {
        if (inverse) {
            // Lower is Better (e.g. Efficiency Ratio)
            // If Last < First = Improved (Green)
            color = last < first ? '#16a34a' : '#dc2626';
        } else {
            // Higher is Better
            color = last > first ? '#16a34a' : '#dc2626';
        }
    }

    return (
        <div className="flex flex-col items-center">
            <div className="h-10 w-24">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <YAxis domain={['dataMin', 'dataMax']} hide />
                        <Tooltip
                            contentStyle={{ fontSize: '10px', padding: '2px' }}
                            formatter={(val) => val.toFixed(2)}
                            labelStyle={{ display: 'none' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke={color}
                            strokeWidth={2}
                            dot={{ r: 1, fill: color }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <span className="text-[10px] text-gray-400">4-Q Trend</span>
        </div>
    );
};

export default TrendSparkline;
