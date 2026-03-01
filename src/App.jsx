import React, { useState, useEffect, lazy, Suspense } from 'react';
import BankSearch from './components/BankSearch';
import FinancialDashboard from './components/FinancialDashboard';
import OperationalDashboard from './components/OperationalDashboard';
import MoversView from './components/MoversView';
import UserProfileMenu from './components/UserProfileMenu';
import LandingPage from './components/LandingPage';
import { formatAssets } from './utils/formatUtils';
import * as fdicService from './services/fdicService';
import FinancialDashboardSkeleton from './components/FinancialDashboardSkeleton';
import PitchbookPresentation from './components/PitchbookPresentation';
import { calculateKPIs } from './utils/kpiCalculator';

// Lazy-loaded heavy components — keeps main bundle lean and avoids Rollup TDZ issues
const MoversSummaryModal = lazy(() => import('./components/MoversSummaryModal'));
const StrategicPlannerTab = lazy(() => import('./components/StrategicPlannerTab'));
const { getBankFinancials, getPeerGroupBenchmark } = fdicService;

// Feature flags: run `localStorage.setItem('feat_market_movers', 'true')` in console to enable
const FEAT_MARKET_MOVERS = localStorage.getItem('feat_market_movers') !== 'false'; // Default to true
const FEAT_AUTH_REQUIRED = localStorage.getItem('feat_auth_required') !== 'false'; // Default to true, allow explicit disable

/**
 * Derive the prior quarter label from a report date string like "Q4 2025".
 * Avoids the need to manually update hardcoded constants each quarter.
 */
const derivePriorQuarter = (reportDate) => {
  if (!reportDate) return null;
  const match = reportDate.match(/^Q([1-4]) (\d{4})$/);
  if (!match) return null;
  let q = parseInt(match[1], 10);
  let y = parseInt(match[2], 10);
  if (q === 1) { q = 4; y -= 1; } else { q -= 1; }
  return `Q${q} ${y}`;
};

function App() {
  const [selectedBank, setSelectedBank] = useState(null);
  const [allHistoricalKPIs, setAllHistoricalKPIs] = useState(null); // full 20-quarter array
  const [selectedQuarterIdx, setSelectedQuarterIdx] = useState(0); // 0 = latest (#2)
  const [benchmarks, setBenchmarks] = useState(null);
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [errorFinancials, setErrorFinancials] = useState(null);
  const [view, setView] = useState('benchmark'); // 'benchmark' | 'movers'
  const [showMovers, setShowMovers] = useState(false);
  const [radarContextBank, setRadarContextBank] = useState(null); // { cert, name, view }
  const [isPresentMode, setIsPresentMode] = useState(false);

  const [secondaryBank, setSecondaryBank] = useState(null);
  const [allSecondaryHistoricalKPIs, setAllSecondaryHistoricalKPIs] = useState(null);
  const [loadingSecondary, setLoadingSecondary] = useState(false);

  // Derive financials from history and selected quarter
  const financials = allHistoricalKPIs && allHistoricalKPIs.length > 0 ? {
    ...allHistoricalKPIs[selectedQuarterIdx],
    history: allHistoricalKPIs.slice(selectedQuarterIdx)
  } : null;

  const secondaryFinancials = allSecondaryHistoricalKPIs && allSecondaryHistoricalKPIs.length > 0 ? {
    ...allSecondaryHistoricalKPIs[selectedQuarterIdx],
    history: allSecondaryHistoricalKPIs.slice(selectedQuarterIdx)
  } : null;

  // Derived quarter labels — driven by the SELECTED quarter snapshot, not always index 0 (#2)
  const CURRENT_QUARTER = financials?.reportDate || null;
  const PRIOR_QUARTER = derivePriorQuarter(CURRENT_QUARTER);

  // Global '/' keyboard shortcut — focus the bank search input (Datadog / Grafana convention)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== '/') return;
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) return;
      e.preventDefault();
      document.getElementById('bank-search-input')?.focus();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  // Clear radar context when bank is deselected
  useEffect(() => {
    if (!selectedBank) {
      const clearState = () => {
        setRadarContextBank(null);
        setView('benchmark');
        setSecondaryBank(null);
        setAllSecondaryHistoricalKPIs(null);
      };
      clearState();
    }
  }, [selectedBank]);

  useEffect(() => {
    if (selectedBank) {
      const fetchPrimary = async () => {
        setLoadingFinancials(true);
        setErrorFinancials(null);
        setSelectedQuarterIdx(0); // Reset to latest on new bank selection (#2)

        // Chain fetches: We need Bank Data first to get ASSET size for the Peer Group
        getBankFinancials(selectedBank.CERT)
          .then(async (bankData) => {
            if (bankData) {
              const historicalKPIs = calculateKPIs(bankData);
              setAllHistoricalKPIs(historicalKPIs); // store full history for quarter selector (#2)

              try {
                const benchmarkData = await getPeerGroupBenchmark(bankData[0].ASSET, bankData[0].STALP);
                if (benchmarkData) {
                  const peerStateCounts = benchmarkData.peerBanks.reduce((acc, peer) => {
                    const st = peer.stalp;
                    acc[st] = (acc[st] || 0) + 1;
                    return acc;
                  }, {});

                  // benchmarkData already contains accurate per-bank means (not aggregate totals)
                  // computed by getPeerGroupBenchmark — spread directly, no re-calculation needed.
                  setBenchmarks({
                    ...benchmarkData,
                    peerStateCounts,
                  });
                }
              } catch (benchmarkErr) {
                console.error("Benchmark fetch failed:", benchmarkErr);
                setErrorFinancials(benchmarkErr.message || "Failed to load peer benchmarks. FDIC API may be down.");
              }
            } else {
              setErrorFinancials("No recent financial data found.");
            }
          })
          .catch(err => {
            console.error(err);
            setErrorFinancials(err.message || "Failed to load financials.");
          })
          .finally(() => setLoadingFinancials(false));
      };
      fetchPrimary();
    } else {
      Promise.resolve().then(() => {
        setBenchmarks(null);
        setAllHistoricalKPIs(null);
        setSelectedQuarterIdx(0);
      });
    }
  }, [selectedBank]);

  useEffect(() => {
    if (secondaryBank) {
      const fetchSecondary = async () => {
        setLoadingSecondary(true);
        getBankFinancials(secondaryBank.CERT)
          .then((bankData) => {
            if (bankData && bankData.length > 0) {
              const historicalKPIs = calculateKPIs(bankData);
              setAllSecondaryHistoricalKPIs(historicalKPIs);
            } else {
              setAllSecondaryHistoricalKPIs(null);
            }
          })
          .catch(err => {
            console.error("Secondary bank fetch failed:", err);
            setAllSecondaryHistoricalKPIs(null);
          })
          .finally(() => setLoadingSecondary(false));
      };
      fetchSecondary();
    } else {
      Promise.resolve().then(() => setAllSecondaryHistoricalKPIs(null));
    }
  }, [secondaryBank]);



  return (
    <div className="min-h-screen font-sans selection:bg-blue-500/30">
      {/* If Present Mode is active, bypass the entire layout and just render the Pitchbook */}
      {isPresentMode ? (
        <PitchbookPresentation
          selectedBank={selectedBank}
          financials={financials}
          benchmarks={benchmarks}
          fdicService={fdicService}
          onClose={() => setIsPresentMode(false)}
          priorQuarter={PRIOR_QUARTER}
          currentQuarter={CURRENT_QUARTER}
        />
      ) : (
        <>
          {/* Global Navigation Header */}
          <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-[100] shadow-sm">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-8">
                <h1
                  className="text-lg sm:text-xl font-black text-white tracking-tight cursor-pointer shrink-0"
                  onClick={() => { setView('benchmark'); setSelectedBank(null); setRadarContextBank(null); }}
                >
                  BANK<span className="text-blue-500">VALUE</span>
                </h1>

                <nav className="flex items-center gap-1 sm:gap-4">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setView('benchmark')}
                      className={`px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center leading-none ${view === 'benchmark'
                        ? 'bg-blue-900/40 text-blue-300'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
                    >
                      <span>Benchmarks</span>
                    </button>
                    <button
                      onClick={() => setView('movers')}
                      disabled={!selectedBank}
                      title={!selectedBank ? "Select a bank first to unlock Competitive Radar" : "Analyze peer group movements"}
                      className={`px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center leading-none ${view === 'movers'
                        ? 'bg-blue-900/40 text-blue-300'
                        : !selectedBank
                          ? 'text-slate-600 opacity-40 cursor-not-allowed'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
                    >
                      <span>Radar</span>
                    </button>
                    <button
                      onClick={() => setView('planner')}
                      disabled={!selectedBank}
                      title={!selectedBank ? "Select a bank first to unlock Strategic Planner" : "Run what-if strategic scenarios"}
                      className={`px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center leading-none ${view === 'planner'
                        ? 'bg-blue-900/40 text-blue-300'
                        : !selectedBank
                          ? 'text-slate-600 opacity-40 cursor-not-allowed'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
                    >
                      <span>Planner</span>
                    </button>
                  </div>

                  {/* Authenticated User Menu */}
                  <div className="pl-2 sm:pl-4 border-l border-slate-200 ml-1 sm:ml-2">
                    <UserProfileMenu />
                  </div>

                  {/* Back to Suite */}
                  <a
                    href="https://fdic-suite-landing.vercel.app"
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-blue-300 hover:bg-blue-900/40 transition-all border border-slate-700 ml-2"
                    aria-label="Back to FDIC Intelligence Suite"
                  >
                    Suite Home
                  </a>
                </nav>
              </div>

              {selectedBank && (
                <div className={`hidden md:flex items-center gap-3 px-4 py-1.5 bg-slate-800/50 rounded-full text-xs font-bold text-slate-300 border border-slate-700/50 ${radarContextBank ? 'border-blue-500/50 bg-blue-900/30' : ''}`}>
                  <span className={`w-2 h-2 rounded-full ${radarContextBank ? 'bg-blue-400' : 'bg-emerald-400 animate-pulse'}`}></span>
                  {selectedBank.NAME}
                  {radarContextBank && <span className="text-[10px] text-blue-400 ml-1">(Peer Drill-down)</span>}
                </div>
              )}
            </div>
          </header>

          <main className={
            isPresentMode
              ? "w-full max-w-full min-h-screen bg-slate-50 relative p-4"
              : (!selectedBank && view === 'benchmark') ? "w-full" : "max-w-7xl mx-auto px-4 py-8"
          }>
            {!selectedBank && view === 'benchmark' ? (
              <LandingPage onBankSelect={(bank) => {
                setRadarContextBank(null);
                setSelectedBank(bank);
              }} />
            ) : (
              <div className="space-y-8">
                {/* Header Area For All Views */}
                <div className="max-w-4xl mx-auto space-y-6">
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
                      className="flex items-center gap-2 text-sm font-bold text-blue-400 hover:text-blue-300 transition-all bg-blue-900/30 px-4 py-2 rounded-xl border border-blue-500/30 shadow-sm hover:shadow-md animate-in slide-in-from-left-2 duration-300"
                    >
                      <span>&larr;</span> Back to {radarContextBank.name} Competitive Radar
                    </button>
                  )}

                  {/* Shared Bank Info Header */}
                  {selectedBank && (
                    <div className="mb-6 flex flex-col items-start px-2 mt-2">
                      {/* Only show Back to Search if we are not in peer drilldown mode (has its own back button) */}
                      {!isPresentMode && !radarContextBank && (
                        <button
                          onClick={() => { setSelectedBank(null); setView('benchmark'); }}
                          className="flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-blue-400 transition-colors mb-4 group"
                        >
                          <span className="transform group-hover:-translate-x-1 transition-transform">&larr;</span> Back to Search
                        </button>
                      )}

                      <div className="w-full flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="relative">
                          {radarContextBank && !isPresentMode && (
                            <div className="inline-block px-3 py-1 mb-2 bg-blue-600/20 border border-blue-500/30 text-blue-300 text-[10px] font-bold uppercase tracking-widest rounded shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                              Peer Analysis Mode
                            </div>
                          )}
                          <h2 className="text-3xl font-bold text-white tracking-tight leading-tight mb-1.5">{selectedBank.NAME}</h2>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-slate-400 text-sm">
                            <p className="font-medium flex items-center gap-2">
                              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {selectedBank.CITY}, {selectedBank.STNAME}
                              <span className="text-slate-400 font-normal ml-1 shrink-0">|</span>
                              <span className="text-slate-400 font-normal ml-1">Cert: {selectedBank.CERT}</span>
                            </p>

                            {CURRENT_QUARTER && (
                              <div className="flex items-center gap-1.5 bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-500/30" title="Data period from FDIC Call Reports">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">As of {CURRENT_QUARTER}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 md:justify-end shrink-0">
                          {/* #2 — Quarter selector: lets the user view a historical snapshot */}
                          {allHistoricalKPIs && allHistoricalKPIs.length > 1 && (
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Report Period</span>
                              <select
                                value={selectedQuarterIdx}
                                onChange={e => setSelectedQuarterIdx(Number(e.target.value))}
                                className="text-sm font-bold text-slate-200 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 shadow-sm cursor-pointer hover:border-slate-500 transition-colors outline-none"
                                aria-label="Select reporting quarter"
                              >
                                {allHistoricalKPIs.slice(0, 8).map((kpi, idx) => (
                                  <option key={idx} value={idx}>
                                    {kpi.reportDate}{idx === 0 ? ' (Latest)' : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {financials && financials.raw && (
                            <div className="px-5 py-2.5 bg-slate-900/40 backdrop-blur-md border border-slate-700/50 text-white rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.02)] ring-1 ring-white/5">
                              <span className="text-[10px] font-bold text-slate-400 block leading-none mb-1 uppercase tracking-wider">Total Assets</span>
                              <span className="text-xl font-bold leading-none block tracking-tight">
                                {formatAssets(financials.raw.ASSET)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* View Switching */}
                {view === 'movers' ? (
                  <Suspense fallback={<div className="flex justify-center items-center h-64 text-blue-600 animate-pulse font-bold">Loading Competitive Radar...</div>}>
                    <MoversView
                      dataProvider={fdicService}
                      perspectiveBankName={selectedBank?.NAME || 'Market'}
                      focusBankCert={selectedBank ? String(selectedBank.CERT) : null}
                      segmentKey={benchmarks?.assetFilter || 'ASSET:[50000000 TO 250000000]'}
                      segmentLabel={benchmarks?.groupName || 'Big Regionals ($50B - $250B)'}
                      priorQuarter={PRIOR_QUARTER}
                      currentQuarter={CURRENT_QUARTER}
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
                  </Suspense>
                ) : (
                  <div className="max-w-4xl mx-auto space-y-8">
                    <div className={`bg-transparent relative ${isPresentMode ? 'min-h-[90vh]' : ''}`}>
                      {loadingFinancials && view === 'benchmark' && (
                        <div className="bg-white p-6 rounded-lg shadow-lg relative overflow-hidden mt-8">
                          <FinancialDashboardSkeleton />
                        </div>
                      )}
                      {errorFinancials && <div className="text-red-500 my-10 bg-red-50 p-6 rounded-lg text-center shadow-sm border border-red-100">{errorFinancials}</div>}

                      {financials && !loadingFinancials && view === 'benchmark' && (
                        <div className="w-full relative animate-fade-in-up" style={{ animationDelay: '0ms' }}>
                          <FinancialDashboard
                            financials={financials}
                            benchmarks={benchmarks}
                            authRequired={FEAT_AUTH_REQUIRED}
                            isPresentMode={isPresentMode}
                            setIsPresentMode={setIsPresentMode}
                            secondaryBank={secondaryBank}
                            setSecondaryBank={setSecondaryBank}
                            secondaryFinancials={secondaryFinancials}
                            loadingSecondary={loadingSecondary}
                          />
                        </div>
                      )}

                      {selectedBank && view === 'benchmark' && !loadingFinancials && (
                        <div className="w-full relative mt-12 animate-fade-in-up" style={{ animationDelay: '500ms' }}>
                          <OperationalDashboard
                            key={selectedBank.CERT}
                            assetSize={financials?.raw?.ASSET ? parseFloat(financials.raw.ASSET) : 0}
                          />
                        </div>
                      )}

                      {financials && !loadingFinancials && view === 'planner' && (
                        <div className="w-full relative animate-fade-in-up">
                          <Suspense fallback={<div className="flex justify-center items-center h-64 text-blue-400 animate-pulse font-bold">Loading Strategic Planner...</div>}>
                            <StrategicPlannerTab
                              financials={financials}
                              benchmarks={benchmarks}
                            />
                          </Suspense>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>

          {/* Render the AI Intelligence Modal if triggered gracefully from anywhere */}
          {FEAT_MARKET_MOVERS && showMovers && selectedBank && (
            <Suspense fallback={null}>
              <MoversSummaryModal
                isOpen={showMovers}
                onClose={() => setShowMovers(false)}
                dataProvider={fdicService}
                perspectiveBankName={selectedBank.NAME}
                focusBankCert={String(selectedBank.CERT)}
                segmentKey={benchmarks?.assetFilter || 'DYNAMIC'}
                segmentLabel={benchmarks?.groupName || 'Peer Group'}
                priorQuarter={PRIOR_QUARTER}
                currentQuarter={CURRENT_QUARTER}
                authRequired={FEAT_AUTH_REQUIRED}
              />
            </Suspense>
          )}

          <footer className="text-center mt-12 pb-6 text-slate-400 text-xs select-none">
            © {new Date().getFullYear()} Vincent Chamasrour. All rights reserved.{' '}
            <span title="Value Benchmark MVP is a proprietary tool. Unauthorized reproduction or distribution is prohibited.">™</span>
          </footer>
        </>
      )}
    </div>
  );
}

export default App;
