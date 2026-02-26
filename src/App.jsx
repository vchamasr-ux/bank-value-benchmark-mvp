import React, { useState, useEffect } from 'react';
import BankSearch from './components/BankSearch';
import FinancialDashboard from './components/FinancialDashboard';
import OperationalDashboard from './components/OperationalDashboard';
import MarketMoversPanel from './components/MarketMoversPanel';
import { getBankFinancials, getPeerGroupBenchmark } from './services/fdicService';
import { calculateKPIs } from './utils/kpiCalculator';

// Feature flag: run `localStorage.setItem('feat_market_movers', 'true')` in console to enable
const FEAT_MARKET_MOVERS = localStorage.getItem('feat_market_movers') === 'true';

function App() {
  const [selectedBank, setSelectedBank] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [benchmarks, setBenchmarks] = useState(null);
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [errorFinancials, setErrorFinancials] = useState(null);
  const [showMovers, setShowMovers] = useState(false); // Market Movers overlay

  // Sync selected bank to localStorage so the sidecar window can read it
  useEffect(() => {
    if (selectedBank) {
      localStorage.setItem('sidecar_focus_cert', String(selectedBank.CERT));
      localStorage.setItem('sidecar_focus_name', selectedBank.NAME);
    } else {
      localStorage.removeItem('sidecar_focus_cert');
      localStorage.removeItem('sidecar_focus_name');
    }
  }, [selectedBank]);

  useEffect(() => {
    if (selectedBank) {
      setLoadingFinancials(true);
      setErrorFinancials(null);

      // Chain fetches: We need Bank Data first to get ASSET size for the Peer Group
      getBankFinancials(selectedBank.CERT)
        .then(async (bankData) => {
          if (bankData) {
            // bankData is now an array of 5 quarters
            const historicalKPIs = calculateKPIs(bankData);
            const latestKPIs = historicalKPIs[0];
            setFinancials(latestKPIs);
            // Store history in the financials object or separate state?
            // Let's attach history to the latest object for simplicity in passing down
            latestKPIs.history = historicalKPIs;

            // Now fetch Peer Group Benchmark based on Assets and Location (State)
            // Use latest Asset size
            const benchmarkData = await getPeerGroupBenchmark(bankData[0].ASSET, bankData[0].STALP);
            if (benchmarkData) {
              // Aggregate peer states for Map
              const peerStateCounts = benchmarkData.peerBanks.reduce((acc, peer) => {
                const st = peer.stalp;
                acc[st] = (acc[st] || 0) + 1;
                return acc;
              }, {});

              setBenchmarks({
                ...calculateKPIs(benchmarkData),
                assetGrowth3Y: benchmarkData.assetGrowth3Y,
                loanGrowth3Y: benchmarkData.loanGrowth3Y,
                depositGrowth3Y: benchmarkData.depositGrowth3Y,
                groupName: benchmarkData.groupName,
                sampleSize: benchmarkData.sampleSize,
                peerBanks: benchmarkData.peerBanks,
                peerStateCounts, // Pass to dashboard
                p25: benchmarkData.p25,
                p75: benchmarkData.p75
              });
            }
          } else {
            setErrorFinancials("No recent financial data found.");
          }
        })
        .catch(err => {
          console.error(err);
          setErrorFinancials("Failed to load financials.");
        })
        .finally(() => setLoadingFinancials(false));
    } else {
      setFinancials(null);
      setBenchmarks(null);
    }
  }, [selectedBank]);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-extrabold text-blue-900 mb-2 tracking-tight">
          Value Benchmark MVP
        </h1>
        <p className="text-lg text-gray-600">
          Real-time FDIC Financial Performance Benchmarks
        </p>
      </header>

      <main className="max-w-4xl mx-auto space-y-8">
        {!selectedBank ? (
          <section>
            <BankSearch onBankSelect={setSelectedBank} />
          </section>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{selectedBank.NAME}</h2>
            <div className="flex flex-col items-center gap-1 mb-2">
              <p className="text-gray-600">{selectedBank.CITY}, {selectedBank.STNAME} (Cert: {selectedBank.CERT})</p>
              {financials?.reportDate && (
                <span className="text-xs font-bold px-2 py-0.5 bg-gray-100 text-gray-500 rounded uppercase tracking-wider">
                  Latest Report: {financials.reportDate}
                </span>
              )}
            </div>

            {financials && financials.raw && (
              <div className="mb-4 inline-block bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
                <span className="text-gray-500 font-medium mr-2">Total Assets:</span>
                <span className="text-xl font-bold text-blue-900">
                  {(() => {
                    const asset = parseFloat(financials.raw.ASSET) * 1000;
                    if (asset >= 1e12) return `$${(asset / 1e12).toFixed(2)}T`;
                    if (asset >= 1e9) return `$${(asset / 1e9).toFixed(2)}B`;
                    if (asset >= 1e6) return `$${(asset / 1e6).toFixed(1)}M`;
                    return `$${asset.toLocaleString()}`;
                  })()}
                </span>
              </div>
            )}

            {/* Competitive Brief entry point — feature-flagged */}
            {FEAT_MARKET_MOVERS && financials && benchmarks && (
              <div className="mb-4">
                <button
                  id="competitive-brief-btn"
                  onClick={() => setShowMovers(true)}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg font-semibold text-sm shadow transition-colors"
                >
                  <span>📊</span> Competitive Brief
                  <span className="text-blue-200 text-xs font-mono">{benchmarks.groupName || 'Peer Group'}</span>
                  <span className="ml-1">→</span>
                </button>
              </div>
            )}

            <button
              onClick={() => setSelectedBank(null)}
              className="mb-8 mx-auto flex items-center gap-2 px-4 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors font-medium"
            >
              <span>&larr;</span> Search for another bank
            </button>

            {/* Financial Dashboard */}
            {loadingFinancials && <div className="text-blue-600 animate-pulse my-10">Loading Financial Data...</div>}
            {errorFinancials && <div className="text-red-500 my-10 bg-red-50 p-4 rounded">{errorFinancials}</div>}

            {financials && !loadingFinancials && (
              <FinancialDashboard financials={financials} benchmarks={benchmarks} />
            )}

            {/* Operational Dashboard - Phase 3 */}
            {selectedBank && (
              <OperationalDashboard key={selectedBank.CERT} />
            )}
          </div>
        )}
      </main>

      {/* Market Movers overlay — feature-flagged, mounts above everything */}
      {FEAT_MARKET_MOVERS && showMovers && selectedBank && benchmarks && (
        <MarketMoversPanel
          onClose={() => setShowMovers(false)}
          focusBankCert={String(selectedBank.CERT)}
          perspectiveName={selectedBank.NAME}
          segmentKey={benchmarks.groupName || 'DYNAMIC'}
          segmentLabel={benchmarks.groupName || 'Peer Group'}
          priorQuarter="Q3 2025"
          currentQuarter="Q4 2025"
        />
      )}
      {/* Footer */}
      <footer style={{ textAlign: 'center', marginTop: '3rem', paddingBottom: '1.5rem', color: '#9ca3af', fontSize: '0.75rem', userSelect: 'none' }}>
        © {new Date().getFullYear()} Vincent Chamasrour. All rights reserved.{' '}
        <span title="Value Benchmark MVP is a proprietary tool. Unauthorized reproduction or distribution is prohibited.">™</span>
      </footer>
    </div>
  );
}

export default App;
