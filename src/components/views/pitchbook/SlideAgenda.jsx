export const SlideAgenda = ({ setDirection, setCurrentSlide }) => (
    <div className="flex flex-col items-center justify-center h-full animate-in fade-in slide-in-from-right-8 duration-700">
        <div className="w-full max-w-4xl px-16 py-12 bg-white shadow-xl border-t-8 border-blue-900">
            <h2 className="text-3xl font-serif font-black text-slate-800 mb-10 pb-4 border-b-2 border-slate-100 uppercase tracking-widest">Agenda</h2>
            <div className="space-y-4">
                {[{ num: 'I.', label: 'Strategic Summary & Key Insights', idx: 3 },
                { num: 'II.', label: 'Core Financial Benchmarking', idx: 5 },
                { num: 'III.', label: 'Strategic Outliers & Actions', idx: 7 },
                { num: 'IV.', label: 'Forward-Looking Strategy', idx: 8 }].map(item => (
                    <button
                        key={item.num}
                        onClick={() => { setDirection('forward'); setCurrentSlide(item.idx); }}
                        className="flex items-center gap-6 w-full text-left group hover:bg-slate-50 rounded px-2 py-2 transition-colors"
                    >
                        <span className="text-2xl font-serif font-black text-slate-300 group-hover:text-blue-300 transition-colors w-12 shrink-0">{item.num}</span>
                        <span className="text-xl font-medium text-slate-700 tracking-wide uppercase group-hover:text-blue-900 transition-colors flex-1">{item.label}</span>
                        <svg className="ml-auto w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                ))}
            </div>
        </div>
    </div>
);
