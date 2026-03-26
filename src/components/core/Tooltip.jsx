import React from 'react';

const Tooltip = ({ content, children, position = 'top' }) => {
    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    };

    const arrowPositionClasses = {
        top: 'top-full left-1/2 -translate-x-1/2 border-t-[#0B1120] border-x-transparent border-b-transparent',
        bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-[#0B1120] border-x-transparent border-t-transparent',
        left: 'left-full top-1/2 -translate-y-1/2 border-l-[#0B1120] border-y-transparent border-r-transparent',
        right: 'right-full top-1/2 -translate-y-1/2 border-r-[#0B1120] border-y-transparent border-l-transparent',
    };

    if (!content) return children;

    return (
        <div className="relative group/tooltip inline-block cursor-help">
            {children}
            <div className={`absolute z-[100] invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 pointer-events-none ${positionClasses[position]}`}>
                <div className="bg-[#0B1120]/95 backdrop-blur-md text-slate-100 text-xs font-medium px-4 py-2.5 rounded-lg shadow-[var(--shadow-glass-dark)] whitespace-normal break-words max-w-[250px] text-left border border-white/10 leading-relaxed">
                    {content}
                    {/* Arrow */}
                    <div className={`absolute border-[6px] w-0 h-0 ${arrowPositionClasses[position]}`}></div>
                </div>
            </div>
        </div>
    );
};

export default Tooltip;
