import React from 'react';
import MarketMoversConcise from './market_movers/market_movers';
import { sidecarDataProvider } from './market_movers/fdicAdapter';

/**
 * MarketMoversPanel
 *
 * Full-screen overlay that wraps MarketMoversConcise.
 * Triggered from App.jsx when the user clicks "Competitive Brief →" on a bank page.
 *
 * Props:
 *   onClose           — called when the user hits Escape or the close button
 *   focusBankCert     — CERT of the selected bank (string)
 *   perspectiveName   — display name of the selected bank
 *   segmentKey        — peer segment identifier (from benchmarks.groupName)
 *   segmentLabel      — human-readable segment label (e.g., "Peer Group")
 *   priorQuarter      — e.g., "Q3 2025"
 *   currentQuarter    — e.g., "Q4 2025"
 */
export default function MarketMoversPanel({
    onClose,
    focusBankCert,
    perspectiveName,
    segmentKey,
    segmentLabel = 'Peer Group',
    priorQuarter = 'Q3 2025',
    currentQuarter = 'Q4 2025',
}) {
    // Close on Escape key
    React.useEffect(() => {
        function onKey(e) { if (e.key === 'Escape') onClose(); }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        /* backdrop */
        <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            {/* panel */}
            <div className="relative bg-gray-900 flex-1 overflow-y-auto">
                {/* close bar */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
                    <div>
                        <span className="text-blue-400 font-bold text-lg">Competitive Brief</span>
                        <span className="ml-3 text-gray-400 text-sm font-mono">
                            {perspectiveName} — {currentQuarter} vs {priorQuarter}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors text-2xl leading-none px-2"
                        title="Close (Esc)"
                        aria-label="Close competitive brief"
                    >
                        ✕
                    </button>
                </div>

                {/* content */}
                <div className="text-white">
                    <MarketMoversConcise
                        key={focusBankCert}
                        dataProvider={sidecarDataProvider}
                        segmentKey={segmentKey}
                        segmentLabel={segmentLabel}
                        priorQuarter={priorQuarter}
                        currentQuarter={currentQuarter}
                        perspectiveBankName={perspectiveName}
                        topN={5}
                        focusBankCert={focusBankCert}
                    />
                </div>
            </div>
        </div>
    );
}
