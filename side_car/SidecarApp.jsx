import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import MarketMoversConcise from './market_movers';
import { sidecarDataProvider } from './fdicAdapter';
import '../src/index.css';

/**
 * SidecarApp.jsx
 *
 * On load: reads the bank the main app last selected from localStorage.
 * Falls back to JPMorgan Chase (CERT 628) if nothing is stored yet.
 *
 * Update button: re-reads localStorage so switching banks in the main app
 * and clicking Update is all that's needed — no backend required.
 */

const JPM_FALLBACK = { cert: '628', name: 'JPMorgan Chase' };

function readFromMainApp() {
    const cert = localStorage.getItem('sidecar_focus_cert');
    const name = localStorage.getItem('sidecar_focus_name');
    if (cert && name) return { cert, name, source: 'synced' };
    return { ...JPM_FALLBACK, source: 'fallback' };
}

function SidecarApp() {
    const initial = readFromMainApp();
    const [focusCert, setFocusCert] = useState(initial.cert);
    const [perspectiveName, setPerspectiveName] = useState(initial.name);
    const [syncStatus, setSyncStatus] = useState(initial.source); // 'synced' | 'fallback'

    function handleUpdate() {
        const { cert, name, source } = readFromMainApp();
        setFocusCert(cert);
        setPerspectiveName(name);
        setSyncStatus(source);
    }

    return (
        <div className="bg-gray-900 min-h-screen text-white p-8">
            <header className="mb-12 border-b border-gray-800 pb-6 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-blue-400">Intelligence Terminal</h1>
                    <p className="text-gray-400">Market Movers &amp; Competitive Signals</p>
                </div>

                <div className="flex gap-3 items-center bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex gap-2 items-center">
                            <span className="text-sm text-gray-400 font-medium">Focus Bank:</span>
                            <span className="text-sm text-white font-bold">{perspectiveName}</span>
                            <span className="text-xs text-gray-500 font-mono">(CERT {focusCert})</span>
                        </div>
                        {syncStatus === 'fallback' && (
                            <div className="text-[10px] text-yellow-500 font-mono">
                                ⚠ No bank selected in main app — using JPM default
                            </div>
                        )}
                        {syncStatus === 'synced' && (
                            <div className="text-[10px] text-green-500 font-mono">
                                ✔ Synced from main app
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleUpdate}
                        title="Re-reads whichever bank is selected in the main app tab"
                        className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded text-sm font-bold transition-colors whitespace-nowrap"
                    >
                        Update
                    </button>
                </div>
            </header>

            <main className="max-w-6xl mx-auto">
                <MarketMoversConcise
                    key={focusCert}
                    dataProvider={sidecarDataProvider}
                    segmentKey="DYNAMIC"
                    segmentLabel="Peer Group"
                    priorQuarter="Q3 2025"
                    currentQuarter="Q4 2025"
                    perspectiveBankName={perspectiveName}
                    topN={5}
                    focusBankCert={focusCert}
                />
            </main>

            <footer className="mt-20 pt-8 border-t border-gray-800 text-sm text-gray-500 text-center">
                Sidecar Intelligence Terminal — Isolated from Main Application
            </footer>
        </div>
    );
}

const root = document.getElementById('sidecar-root');
if (root) {
    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <SidecarApp />
        </React.StrictMode>
    );
} else {
    console.error("Critical Failure: #sidecar-root not found.");
}
