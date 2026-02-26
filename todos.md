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
- [x] Calculate all 9 financial KPIs.
- [x] Calculate 3-Year CAGR for Asset, Loan, and Deposit Growth.
- [x] Calculate YoY annual growth history (for sparkline trendlines).

---

## Phase 2: Visualization — Financial Gauges ✅
- [x] Create `GaugeChart.jsx` using Recharts PieChart (semi-circle).
- [x] Implement color logic: Red / Yellow / Green (auto-inverts for "Lower is Better" metrics).
- [x] Implement **P25/P75 quartile zone shading** (visual display on gauge without explicit text below average).
- [x] Add needle with 1-second CSS transition.
- [x] Create `TrendIndicator.jsx` — shows QoQ arrow + % change.
- [x] Create `TrendSparkline.jsx` — mini hover sparkline.
- [x] Create `FinancialDashboard.jsx` — renders all 12 gauges.

---

## Phase 3: Peer Group Benchmarking ✅
- [x] Implement `getPeerGroupBenchmark()` in `fdicService.js`.
- [x] Proximity-sorting by state adjacency.
- [x] Slice top 20 as peer group.
- [x] Calculate **arithmetic mean** (benchmarks) and **P25 / P75 distributions**.
- [x] Create `PeerGroupModal.jsx` and `USMap.jsx` (tile-grid map).

---

## Phase 4: The "Exchange" — Operational Data ✅
- [x] Create `src/data/operationalBenchmarks.json`.
- [x] Create `OperationalDashboard.jsx` with locked/blurred overlay.
- [x] "Unlock Your Scorecard" form with 5 numeric inputs.

---

## Phase 5: AI Summarize & Competitive Brief ✅
- [x] Create `SummaryModal.jsx` and `market_movers.jsx`.
- [x] Integrate with Gemini API (`gemini-2.5-flash`).
- [x] Implement Robust Z-Score analysis for Movers.
- [x] Add **Mover Drill-down**: instantly refocus main app on a peer mover by clicking their name.

---

## Phase 6: Authentication & Quota Management ✅
- [x] Implement LinkedIn OAuth 2.0 Login.
- [x] Create `AuthContext` and `LoginModal`.
- [x] Build serverless proxy endpoints in `api/`.
- [x] Implement **Vercel KV Daily Quotas** (2 calls/day for standard users).
- [x] Add User Registration flow with admin notification.

---

## Phase 7: Cleanup & Final Documentation ✅ _(February 2026)_
- [x] Remove all debug scripts and unused test infrastructure.
- [x] Rename `App Feature Context` to `context.md` for consistency.
- [x] Update `blueprint.md`, `specifications.md`, and `context.md` to reflect final state.
- [x] Perform final code review and verify build pass.

---

## Open / Future Work
- [ ] Add in-memory (or `localStorage`) caching for FDIC peer KPI fetches to reduce API load.
- [ ] Consider adding a quarterly date selector to use more recent FDIC baseline for 3Y growth.
- [ ] Explore adding Option 3 (playbook mining / historical analog quarters) to the sidecar.