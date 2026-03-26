import { useState, useEffect } from 'react';
import { calculateKPIs } from '../utils/kpiCalculator';
import * as fdicService from '../services/fdicService';

/**
 * Derive the prior quarter label from a report date string like "Q4 2025".
 * Avoids the need to manually update hardcoded constants each quarter.
 */
export const derivePriorQuarter = (reportDate) => {
  if (!reportDate) return null;
  const match = reportDate.match(/^Q([1-4]) (\d{4})$/);
  if (!match) return null;
  let q = parseInt(match[1], 10);
  let y = parseInt(match[2], 10);
  if (q === 1) { q = 4; y -= 1; } else { q -= 1; }
  return `Q${q} ${y}`;
};

// Deep-linking support parsed lazily for initial state
export const getInitialBank = (paramName) => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const cert = params.get(paramName) || (paramName === 'acq' ? params.get('b') : null);
  return cert ? { CERT: cert, NAME: 'Loading...', CITY: '', STNAME: '' } : null;
};

export const useBankData = () => {
  const [selectedBank, setSelectedBank] = useState(() => getInitialBank('acq'));
  const [allHistoricalKPIs, setAllHistoricalKPIs] = useState(null);
  const [selectedQuarterIdx, setSelectedQuarterIdx] = useState(0);
  const [benchmarks, setBenchmarks] = useState(null);
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [errorFinancials, setErrorFinancials] = useState(null);
  const [view, setView] = useState('benchmark'); // 'benchmark' | 'movers' | 'planner'
  const [radarContextBank, setRadarContextBank] = useState(null); // { cert, name, view }

  const [secondaryBank, setSecondaryBank] = useState(() => getInitialBank('tgt'));
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

  const CURRENT_QUARTER = financials?.reportDate || null;
  const PRIOR_QUARTER = derivePriorQuarter(CURRENT_QUARTER);

  // Clear radar context when bank is deselected
  useEffect(() => {
    if (!selectedBank) {
      setRadarContextBank(null);
      setView('benchmark');
      setSecondaryBank(null);
      setAllSecondaryHistoricalKPIs(null);
    }
  }, [selectedBank]);

  useEffect(() => {
    if (selectedBank) {
      const fetchPrimary = async () => {
        setLoadingFinancials(true);
        setErrorFinancials(null);
        setSelectedQuarterIdx(0); // Reset to latest on new bank selection

        fdicService.getBankFinancials(selectedBank.CERT)
          .then(async (bankData) => {
            if (bankData) {
              const historicalKPIs = calculateKPIs(bankData);
              setAllHistoricalKPIs(historicalKPIs);

              try {
                const benchmarkData = await fdicService.getPeerGroupBenchmark(bankData[0].ASSET, bankData[0].STALP);
                if (benchmarkData) {
                  const peerStateCounts = benchmarkData.peerBanks.reduce((acc, peer) => {
                    const st = peer.stalp;
                    acc[st] = (acc[st] || 0) + 1;
                    return acc;
                  }, {});
                  setBenchmarks({
                    ...benchmarkData,
                    peerStateCounts,
                  });
                }
              } catch (benchmarkErr) {
                console.error("Benchmark fetch failed:", benchmarkErr);
                setErrorFinancials(benchmarkErr.message || "Failed to load peer benchmarks.");
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
        fdicService.getBankFinancials(secondaryBank.CERT)
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

  return {
    selectedBank, setSelectedBank,
    allHistoricalKPIs, setAllHistoricalKPIs,
    selectedQuarterIdx, setSelectedQuarterIdx,
    benchmarks,
    loadingFinancials,
    errorFinancials,
    view, setView,
    radarContextBank, setRadarContextBank,
    secondaryBank, setSecondaryBank,
    secondaryFinancials,
    loadingSecondary,
    financials,
    CURRENT_QUARTER,
    PRIOR_QUARTER
  };
};
