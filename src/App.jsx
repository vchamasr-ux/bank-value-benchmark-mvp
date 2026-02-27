import React, { useState, useEffect } from 'react';
import BankSearch from './components/BankSearch';
import FinancialDashboard from './components/FinancialDashboard';
import OperationalDashboard from './components/OperationalDashboard';
import MoversSummaryModal from './components/MoversSummaryModal';
import MoversView from './components/MoversView';
import UserProfileMenu from './components/UserProfileMenu';
import { sidecarDataProvider } from './components/market_movers/fdicAdapter';
import { getBankFinancials, getPeerGroupBenchmark } from './services/fdicService';
import { calculateKPIs } from './utils/kpiCalculator';

// Feature flags: run `localStorage.setItem('feat_market_movers', 'true')` in console to enable
const FEAT_MARKET_MOVERS = localStorage.getItem('feat_market_movers') === 'true';
const FEAT_AUTH_REQUIRED = localStorage.getItem('feat_auth_required') !== 'false'; // Default to true, allow explicit disable

function App() {
  const [selectedBank, setSelectedBank] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [benchmarks, setBenchmarks] = useState(null);
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [errorFinancials, setErrorFinancials] = useState(null);
  const [view, setView] = useState('benchmark'); // 'benchmark' | 'movers'
  const [showMovers, setShowMovers] = useState(false);
  const [radarContextBank, setRadarContextBank] = useState(null); // { cert, name, view }

  // Sync selected bank and manage radar context
  useEffect(() => {
    if (selectedBank) {
      // If we select a NEW bank manually (not via drill-down), clear radar context
      if (!radarContextBank || (String(selectedBank.CERT) !== String(radarContextBank.cert))) {
        if (view === 'benchmark' && !radarContextBank) {
          // Reset context if we search/select something else entirely
        }
      }
    } else {
      setRadarContextBank(null);
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
            const historicalKPIs = calculateKPIs(bankData);
            const latestKPIs = historicalKPIs[0];
            setFinancials(latestKPIs);
            latestKPIs.history = historicalKPIs;

            const benchmarkData = await getPeerGroupBenchmark(bankData[0].ASSET, bankData[0].STALP);
            if (benchmarkData) {
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
                peerStateCounts,
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
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
      {/* Global Navigation Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-[100] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-8">
            <h1
              className="text-lg sm:text-xl font-black text-blue-900 tracking-tight cursor-pointer shrink-0"
              onClick={() => { setView('benchmark'); setSelectedBank(null); setRadarContextBank(null); }}
            >
              BANK<span className="text-blue-600">VALUE</span>
            </h1>

            <nav className="flex items-center gap-1 sm:gap-4">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setView('benchmark')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'benchmark'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
                >
                  Banks
                </button>
                <button
                  onClick={() => setView('movers')}
                  disabled={!selectedBank}
                  title={!selectedBank ? "Select a bank first to unlock Competitive Radar" : "Analyze peer group movements"}
                  className={`px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex flex-col items-start leading-none ${view === 'movers'
                    ? 'bg-blue-50 text-blue-700'
                    : !selectedBank
                      ? 'text-slate-300 opacity-40 cursor-not-allowed'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
                >
                  <span>Market Movers</span>
                  <span className="hidden sm:inline text-[10px] opacity-70 font-medium tracking-tight">Competitive Radar</span>
                </button>
              </div>

              {/* Authenticated User Menu */}
              <div className="pl-2 sm:pl-4 border-l border-slate-200 ml-1 sm:ml-2">
                <UserProfileMenu />
              </div>
            </nav>
          </div>

          {selectedBank && view === 'benchmark' && (
            <div className={`hidden md:flex items-center gap-3 px-4 py-1.5 bg-slate-100 rounded-full text-xs font-bold text-slate-600 border border-slate-200 ${radarContextBank ? 'border-blue-200 bg-blue-50/50' : ''}`}>
              <span className={`w-2 h-2 rounded-full ${radarContextBank ? 'bg-blue-500' : 'bg-green-500 animate-pulse'}`}></span>
              {selectedBank.NAME}
              {radarContextBank && <span className="text-[10px] text-blue-400 ml-1">(Peer Drill-down)</span>}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {view === 'movers' ? (
          <MoversView
            dataProvider={sidecarDataProvider}
            perspectiveBankName={selectedBank?.NAME || 'Market'}
            focusBankCert={selectedBank ? String(selectedBank.CERT) : null}
            segmentKey={benchmarks?.groupName || 'ASSET:[50000000 TO 250000000]'}
            segmentLabel={benchmarks?.groupName || 'Big Regionals ($50B - $250B)'}
            priorQuarter="Q3 2025"
            currentQuarter="Q4 2025"
            onDrillDown={async (cert) => {
              // Maintain radar context of the SOURCE bank
              if (selectedBank) {
                setRadarContextBank({
                  cert: String(selectedBank.CERT),
                  name: selectedBank.NAME
                });
              }
              const data = await getBankFinancials(cert);
              if (data && data.length > 0) {
                setSelectedBank({
                  CERT: cert,
                  NAME: data[0].NAME || 'Selected Bank',
                  CITY: data[0].CITY || '',
                  STNAME: data[0].STALP || data[0].STNAME || ''
                });
                setView('benchmark');
              }
            }}
            onShowBrief={() => setShowMovers(true)}
          />
        ) : (
          <div className="space-y-8">
            {!selectedBank ? (
              <section className="max-w-3xl mx-auto pt-10">
                <div className="text-center mb-12">
                  <h2 className="text-4xl font-black text-blue-900 mb-4 tracking-tight">Real-time Performance Benchmarks</h2>
                  <p className="text-lg text-slate-600">Search 4,000+ FDIC-insured institutions to instantly map their strategic posture.</p>
                </div>
                <BankSearch onBankSelect={(bank) => {
                  setRadarContextBank(null);
                  setSelectedBank(bank);
                }} />
              </section>
            ) : (
              <div className="max-w-4xl mx-auto space-y-8">
                {/* Contextual Back Button */}
                {radarContextBank && (
                  <button
                    onClick={async () => {
                      const sourceCert = radarContextBank.cert;
                      setRadarContextBank(null); // Clear context as we are going "home"
                      const data = await getBankFinancials(sourceCert);
                      if (data && data.length > 0) {
                        setSelectedBank({
                          CERT: sourceCert,
                          NAME: data[0].NAME || 'Selected Bank',
                          CITY: data[0].CITY || '',
                          STNAME: data[0].STALP || ''
                        });
                        setView('movers');
                      }
                    }}
                    className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800 transition-all bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 shadow-sm hover:shadow-md animate-in slide-in-from-left-2 duration-300"
                  >
                    <span>&larr;</span> Back to {radarContextBank.name} Competitive Radar
                  </button>
                )}

                <div className="bg-white p-6 rounded-lg shadow-lg text-center relative overflow-hidden">
                  {radarContextBank && (
                    <div className="absolute top-0 right-0 px-3 py-1 bg-blue-900 text-white text-[10px] font-black uppercase tracking-widest rounded-bl-lg opacity-80">
                      Peer Analysis Mode
                    </div>
                  )}
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
                    <div className="mb-4 inline-flex items-center bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 max-w-full">
                      <span className="text-gray-500 font-medium mr-2 whitespace-nowrap">Total Assets:</span>
                      <span className="text-lg sm:text-xl font-bold text-blue-900 truncate">
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

                  {loadingFinancials && <div className="text-blue-600 animate-pulse my-10">Loading Financial Data...</div>}
                  {errorFinancials && <div className="text-red-500 my-10 bg-red-50 p-4 rounded">{errorFinancials}</div>}

                  {financials && !loadingFinancials && (
                    <FinancialDashboard
                      financials={financials}
                      benchmarks={benchmarks}
                      onShowMovers={() => { setView('movers'); }}
                      showMoversButton={FEAT_MARKET_MOVERS}
                      authRequired={FEAT_AUTH_REQUIRED}
                    />
                  )}

                  {selectedBank && (
                    <OperationalDashboard key={selectedBank.CERT} />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {FEAT_MARKET_MOVERS && showMovers && selectedBank && benchmarks && (
        <MoversSummaryModal
          isOpen={showMovers}
          onClose={() => setShowMovers(false)}
          dataProvider={sidecarDataProvider}
          perspectiveBankName={selectedBank.NAME}
          focusBankCert={String(selectedBank.CERT)}
          segmentKey={benchmarks.groupName || 'DYNAMIC'}
          segmentLabel={benchmarks.groupName || 'Peer Group'}
          priorQuarter="Q3 2025"
          currentQuarter="Q4 2025"
          authRequired={FEAT_AUTH_REQUIRED}
        />
      )}

      <footer className="text-center mt-12 pb-6 text-slate-400 text-xs select-none">
        © {new Date().getFullYear()} Vincent Chamasrour. All rights reserved.{' '}
        <span title="Value Benchmark MVP is a proprietary tool. Unauthorized reproduction or distribution is prohibited.">™</span>
      </footer>
    </div>
  );
}

export default App;
