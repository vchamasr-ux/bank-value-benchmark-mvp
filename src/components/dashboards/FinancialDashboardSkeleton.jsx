import React from 'react';

const FinancialDashboardSkeleton = () => {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header Block */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 mb-6">
                <div>
                    <div className="h-8 bg-slate-200 rounded w-64 mb-2"></div>
                    <div className="h-4 bg-slate-200 rounded w-48"></div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <div className="h-8 w-32 bg-slate-200 rounded-full"></div>
                </div>
            </div>

            {/* Growth Metrics Section */}
            <section>
                <div className="flex items-center gap-2 mb-6 border-b pb-2">
                    <div className="h-6 w-6 bg-slate-200 rounded-lg"></div>
                    <div className="h-6 w-48 bg-slate-200 rounded"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={`growth-${i}`} className="bg-slate-50 rounded-xl p-6 border border-slate-100 flex flex-col items-center shadow-sm">
                            {/* Dial Skeletons */}
                            <div className="w-48 h-24 bg-slate-200 rounded-t-full mb-4"></div>
                            <div className="h-6 w-32 bg-slate-200 rounded text-center"></div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Efficiency Section */}
            <section>
                <div className="flex items-center gap-2 mb-6 border-b pb-2">
                    <div className="h-6 w-6 bg-slate-200 rounded-lg"></div>
                    <div className="h-6 w-48 bg-slate-200 rounded"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={`eff-${i}`} className="bg-slate-50 rounded-xl p-6 border border-slate-100 flex flex-col items-center justify-center shadow-sm h-48">
                            <div className="h-10 w-24 bg-slate-200 rounded mb-4"></div>
                            <div className="h-4 w-32 bg-slate-200 rounded"></div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Returns Section */}
            <section>
                <div className="flex items-center gap-2 mb-6 border-b pb-2">
                    <div className="h-6 w-6 bg-slate-200 rounded-lg"></div>
                    <div className="h-6 w-48 bg-slate-200 rounded"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={`ret-${i}`} className="bg-slate-50 rounded-xl p-6 border border-slate-100 flex flex-col items-center justify-center shadow-sm h-48">
                            <div className="h-10 w-24 bg-slate-200 rounded mb-4"></div>
                            <div className="h-4 w-32 bg-slate-200 rounded"></div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default FinancialDashboardSkeleton;
