# Project Checklist: AI-Driven Value Benchmark Calculator

_Last updated: February 2026 — reflects completed state of all phases._

---

## Phase 0: Project Initialization & Setup ✅
- [x] Initialize React + Vite project.
- [x] Install Tailwind CSS 4.x and configure PostCSS.
- [x] Install `recharts` for gauge visualization.
- [x] Clean up default Vite boilerplate.

---

## Phase 1: The "Hook" — FDIC Data Integration ✅
- [x] Create `src/services/fdicService.js`.
- [x] Implement `searchBank(name)` — searches active banks, sorted by assets DESC.
- [x] Implement `getBankFinancials(certId)` — fetches last 16 quarters of Call Report data.
- [x] Create `src/utils/kpiCalculator.js` with `calculateKPIs()`.
- [x] Calculate all 9 financial KPIs (Efficiency Ratio, NIM, Cost of Funds, Non-Interest Income %, Yield on Loans, Assets/Employee, ROE, ROA, NPL Ratio).
- [x] Calculate 3-Year CAGR for Asset, Loan, and Deposit Growth (requires ≥ 13 quarters of history).
- [x] Calculate YoY annual growth history (for sparkline trendlines).

---

## Phase 2: Visualization — Financial Gauges ✅
- [x] Create `GaugeChart.jsx` using Recharts PieChart (semi-circle).
- [x] Implement color logic: Red / Yellow / Green (auto-inverts for "Lower is Better" metrics).
- [x] Implement **P25/P75 quartile zone shading** (Method 2 — distribution-aware sectors).
- [x] Implement fallback equal-sector mode when no quartiles are available (Method 1).
- [x] Add needle with 1-second CSS transition.
- [x] Create `TrendIndicator.jsx` — shows QoQ arrow + % change next to gauge value.
- [x] Create `TrendSparkline.jsx` — mini hover sparkline (4-Q trend or 3-Y YoY annual trend for growth metrics).
- [x] Create `FinancialDashboard.jsx` — renders all 9 KPI gauges + 3 Growth gauges.

---

## Phase 3: Peer Group Benchmarking ✅
- [x] Implement `getPeerGroupBenchmark()` in `fdicService.js`:
  - Classify bank by asset class (6 tiers).
  - Fetch N=500 candidates from FDIC.
  - Deduplicate by CERT.
  - Proximity-sort by state adjacency (using `stateMapping.js`).
  - Slice top 20 as peer group.
  - Fetch Dec 31 2022 historical data for 3-year growth benchmarks.
  - Calculate **arithmetic mean** (not weighted aggregate) for all 12 KPI benchmarks.
  - Calculate **P25 / P75 distributions** for all 12 KPIs.
- [x] Export **`getAssetGroupConfig(assetSize)`** — shared function used by both main app and sidecar (eliminates code duplication).
- [x] Create `stateMapping.js` with full US adjacency map and `getProximityScore()`.
- [x] Create `PeerGroupModal.jsx` — lists all 20 peer banks with city, state, assets.
- [x] Create `USMap.jsx` — tile-grid geographic distribution map (rendered inside PeerGroupModal).

---

## Phase 4: The "Exchange" — Operational Data & Locking ✅
- [x] Create `src/data/operationalBenchmarks.json` with 5 Tier 4/5 benchmark estimates.
- [x] Create `OperationalDashboard.jsx` with locked/blurred overlay state.
- [x] "Unlock Your Scorecard" form with 5 numeric inputs.
- [x] On unlock: removes overlay, renders user inputs vs. seed benchmarks in GaugeCharts.

---

## Phase 5: AI Summarize ✅
- [x] Create `SummaryModal.jsx`.
- [x] Constructs a structured financial analysis prompt (bank context + all KPIs + peer benchmarks).
- [x] Fetches from Gemini API (`gemini-2.5-flash`) using `VITE_GEMINI_API_KEY`.
- [x] Handles rate limits (429) with a user-visible error message.
- [x] Renders AI narrative in the modal with proper formatting.

---

## Phase 6: Market Movers Sidecar ✅
- [x] Create `side_car/index.html` as a separate Vite entry point.
- [x] Create `side_car/SidecarApp.jsx` — sidecar React root.
- [x] Create `side_car/market_movers.jsx` — full QoQ mover analysis:
  - Select segment, prior quarter, current quarter, focus bank (CERT).
  - Fetches peer list and 2 quarters of KPIs.
  - Computes deltas, robust z-scores, directional scoring.
  - Builds concise movers tape.
  - Sends tape to Gemini for competitive briefing.
  - Copy-to-clipboard support.
- [x] Create `side_car/fdicAdapter.js` — bridges sidecar to main app services without duplicating logic.
  - Imports `getBankFinancials`, `getAssetGroupConfig` from `src/services/fdicService.js`.
  - Imports `calculateKPIs` from `src/utils/kpiCalculator.js`.
  - Exports `sidecarDataProvider` with `listPeerBanks()`, `getBankKpis()`, `generateGeminiText()`.
- [x] Fix `vite.config.js`: corrected sidecar entry path from non-existent `sidecar.html` → `side_car/index.html`.

---

## Phase 7: Cleanup & Documentation ✅ _(February 2026)_
- [x] Remove all debug scripts (`debug-*.js`, `verify-*.js`, `test-*.js`) from project root.
- [x] Remove all log/output files (`*.txt`, `op_debug.txt`, `curl_output.txt`, etc.).
- [x] Remove all `.test.*` files (8 test files + `src/test/setup.js`).
- [x] Remove unused `devDependencies`: `vitest`, `@testing-library/*`, `jsdom`.
- [x] Remove unused `dependencies`: `clsx`, `tailwind-merge`.
- [x] Remove `"test"` script from `package.json`.
- [x] Remove `test` config block from `vite.config.js`.
- [x] Eliminate duplicate asset class logic: extracted `getAssetGroupConfig()` from `fdicService.js`; `fdicAdapter.js` now imports it instead of maintaining its own copy.
- [x] Update `specifications.md` and `blueprint.md` to reflect final state.
- [x] Confirm build passes (`vite build` — 683 modules, zero errors).

---

## Open / Future Work
- [ ] Add in-memory (or `localStorage`) caching for FDIC peer KPI fetches to reduce API load.
- [ ] Consider adding a quarterly date selector to use more recent FDIC baseline for 3Y growth (currently hardcoded to Dec 31, 2022).
- [ ] Explore adding Option 3 (playbook mining / historical analog quarters) to the sidecar.