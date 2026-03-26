export const SlideCover = ({ selectedBank, currentQuarter }) => (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="w-24 h-24 bg-blue-900 rounded-full flex items-center justify-center shadow-lg border-4 border-white mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
        </div>
        <div>
            <h1 className="text-4xl md:text-5xl font-black font-serif text-slate-800 tracking-tight uppercase">
                Executive Briefing
            </h1>
            <p className="text-xl md:text-2xl text-slate-500 font-serif italic mt-4 tracking-wide">
                Performance Benchmarking Review
            </p>
        </div>
        <div className="mt-8 flex items-center gap-6">
            <span className="text-3xl font-bold text-blue-900">{selectedBank.NAME}</span>
        </div>
        <div className="mt-2 text-slate-500 font-medium">
            {selectedBank.CITY}, {selectedBank.STNAME} • Cert: {selectedBank.CERT}
        </div>
        <div className="mt-12 text-center relative z-10 w-full">
            <p className="text-slate-500 text-sm font-bold tracking-widest uppercase">{currentQuarter} Performance Review</p>
        </div>
    </div>
);
