import React, { useState, useEffect } from 'react';
import BankSearch from './components/BankSearch';
import FinancialDashboard from './components/FinancialDashboard';
import OperationalDashboard from './components/OperationalDashboard';
import { getBankFinancials, getPeerGroupBenchmark } from './services/fdicService';
import { calculateKPIs } from './utils/kpiCalculator';

function App() {
  const [selectedBank, setSelectedBank] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [benchmarks, setBenchmarks] = useState(null); // Dynamic benchmarks
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [errorFinancials, setErrorFinancials] = useState(null);

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
            <p className="text-gray-600 mb-2">{selectedBank.CITY}, {selectedBank.STNAME} (Cert: {selectedBank.CERT})</p>

            {financials && financials.raw && (
              <div className="mb-6 inline-block bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
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
    </div>
  );
}

export default App;
