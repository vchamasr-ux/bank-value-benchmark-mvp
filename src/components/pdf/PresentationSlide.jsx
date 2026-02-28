import React from 'react';

const PresentationSlide = ({ children, title, bankName }) => {
    // A strict 1920x1080px container that will be captured by html-to-image
    return (
        <div className="w-[1920px] h-[1080px] bg-slate-50 relative flex flex-col overflow-hidden">
            {/* Header */}
            <header className="h-[120px] bg-gradient-to-r from-blue-900 to-indigo-900 text-white px-16 flex items-center justify-between shadow-md shrink-0">
                <div className="flex flex-col">
                    <h1 className="text-4xl font-black tracking-tight">{title}</h1>
                    <h2 className="text-xl font-bold text-blue-200 mt-1 uppercase tracking-widest">{bankName}</h2>
                </div>
                {/* Logo Placeholder */}
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
                        <span className="text-blue-900 font-bold text-2xl tracking-tighter">B\</span>
                    </div>
                    <span className="text-2xl font-black tracking-tight">BankValue</span>
                </div>
            </header>

            {/* Slide Content */}
            <main className="flex-1 p-16 flex flex-col gap-12 bg-slate-50">
                {children}
            </main>

            {/* Footer */}
            <footer className="h-[80px] bg-white border-t border-slate-200 px-16 flex items-center justify-between shrink-0">
                <span className="text-slate-500 font-bold text-lg">Confidential - For Internal Use Only</span>
                <span className="text-slate-400 font-medium text-lg">Generated {new Date().toLocaleDateString()}</span>
            </footer>
        </div>
    );
};

export default PresentationSlide;
