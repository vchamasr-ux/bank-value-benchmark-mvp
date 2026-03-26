export const SlidePlanner = ({ financials, getBenchmark }) => {
    const nim = parseFloat(financials.netInterestMargin);
    const cof = parseFloat(financials.costOfFunds);
    const roa = parseFloat(financials.returnOnAssets);
    const bNim = getBenchmark('netInterestMargin');
    const bCof = getBenchmark('costOfFunds');
    const bRoa = getBenchmark('returnOnAssets');
    const nimGap = (nim - bNim).toFixed(2);
    const cofGap = (cof - bCof).toFixed(2);
    const roaGap = (roa - bRoa).toFixed(2);
    const scenarios = [
        { label: 'Rate +100bps', nimImpact: (nim + 0.15).toFixed(2), roaImpact: (roa + 0.05).toFixed(2), color: 'text-emerald-600' },
        { label: 'Rate Flat', nimImpact: nim.toFixed(2), roaImpact: roa.toFixed(2), color: 'text-slate-700' },
        { label: 'Rate -100bps', nimImpact: (nim - 0.15).toFixed(2), roaImpact: (roa - 0.05).toFixed(2), color: 'text-rose-600' },
    ];
    return (
        <div className="w-full h-full flex flex-col justify-center gap-6 px-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 fill-mode-both">
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Net Interest Margin', value: nim.toFixed(2), peer: bNim.toFixed(2), gap: nimGap, better: nim >= bNim },
                    { label: 'Cost of Funds', value: cof.toFixed(2), peer: bCof.toFixed(2), gap: cofGap, better: cof <= bCof },
                    { label: 'Return on Assets', value: roa.toFixed(2), peer: bRoa.toFixed(2), gap: roaGap, better: roa >= bRoa },
                ].map(m => (
                    <div key={m.label} className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center shadow-sm">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{m.label}</div>
                        <div className="text-2xl font-black text-slate-800">{m.value}%</div>
                        <div className="text-xs text-slate-500 mt-1">Peer Avg: {m.peer}%</div>
                        <div className={`text-sm font-bold mt-1 ${m.better ? 'text-emerald-600' : 'text-rose-500'}`}>
                            Gap: {m.gap > 0 ? '+' : ''}{m.gap}%
                        </div>
                    </div>
                ))}
            </div>
            <div>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Rate Shock Scenarios (Illustrative)</div>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full text-sm">
                        <thead><tr className="bg-slate-800 text-white">
                            <th className="px-4 py-2 text-left font-bold">Scenario</th>
                            <th className="px-4 py-2 text-right font-bold">Est. NIM</th>
                            <th className="px-4 py-2 text-right font-bold">Est. ROA</th>
                        </tr></thead>
                        <tbody>
                            {scenarios.map((s, i) => (
                                <tr key={s.label} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                    <td className="px-4 py-3 font-semibold text-slate-700">{s.label}</td>
                                    <td className={`px-4 py-3 text-right font-black ${s.color}`}>{s.nimImpact}%</td>
                                    <td className={`px-4 py-3 text-right font-black ${s.color}`}>{s.roaImpact}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <p className="text-[9px] italic text-slate-400">Scenarios assume linear sensitivity. Actual results depend on asset/liability repricing mix. For illustrative purposes only.</p>
        </div>
    );
};
