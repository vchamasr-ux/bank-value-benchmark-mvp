# Bank Value Benchmark — Architecture Blueprint

_Last updated: February 2026 — reflects final built state._

---

## Application Overview

**Architecture:** Single Page Application (SPA) with a standalone sidecar entry point.

**Frontend:** React 19 + Vite 7 + TailwindCSS 4.x

**Visualization:** Recharts (`PieChart` for gauge, `LineChart` for sparklines)

**Data Source A (Financials):** FDIC BankFind API — real-time public data, no API key required.

**Data Source B (Operational):** `src/data/operationalBenchmarks.json` — static seed benchmarks + user inputs.

**Data Source C (AI Layer):** Gemini API (`gemini-2.5-flash`) — requires `VITE_GEMINI_API_KEY` in `.env.local`.

**State Management:** Component-local React state only (`useState`, `useEffect`). No Redux or Context.

---

## Two Entry Points

| Entry | URL | Purpose |
|---|---|---|
| `index.html` | `http://localhost:5173/` | Main benchmark app |
| `side_car/index.html` | `http://localhost:5173/side_car/index.html` | Market Movers sidecar |

Both are built by a single `vite build` command using the multi-entry Rollup config in `vite.config.js`.

---

## Phase-by-Phase Journey

### Phase 1: Real Data Pipeline
Get the bank `CERT` ID → fetch 16 quarters of Call Report data → run through `kpiCalculator.js`.

**Key files built:**
- `src/services/fdicService.js` — `searchBank()`, `getBankFinancials()`
- `src/utils/kpiCalculator.js` — `calculateKPIs()`, `formatQuarter()`
- `src/components/BankSearch.jsx`

### Phase 2: Visualization
Turn raw KPIs into gauges with peer-aware coloring.

**Key files built:**
- `src/components/GaugeChart.jsx` — semi-circle gauge with P25/P75 sector zones
- `src/components/TrendIndicator.jsx` — QoQ trend arrow
- `src/components/TrendSparkline.jsx` — hover mini chart
- `src/components/FinancialDashboard.jsx` — 9 KPI gauges + 3 growth gauges

### Phase 3: Dynamic Peer Benchmarks
Automatically find 20 peer banks in the same asset class and near the same geography.

**Key files built:**
- `src/services/fdicService.js` — added `getPeerGroupBenchmark()` and `getAssetGroupConfig()`
- `src/utils/stateMapping.js` — US state adjacency map + `getProximityScore()`
- `src/components/PeerGroupModal.jsx` — peer bank list
- `src/components/USMap.jsx` — tile-grid geographic map

### Phase 4: Operational "Give-to-Get"
Unlock operational gauges by submitting your own bank's data.

**Key files built:**
- `src/data/operationalBenchmarks.json`
- `src/components/OperationalDashboard.jsx`

### Phase 5: AI Summarize
One-click Gemini narrative of financial health vs. peer group.

**Key files built:**
- `src/components/SummaryModal.jsx`

### Phase 6: Market Movers Sidecar
Competitive intelligence tool — spots which peers are moving fastest QoQ.

**Key files built:**
- `side_car/index.html` + `side_car/SidecarApp.jsx`
- `side_car/market_movers.jsx`
- `side_car/fdicAdapter.js` — bridge wrapping main app services (no code duplication)

---

## Code Sharing Pattern (Sidecar ↔ Main App)

The sidecar does **not** have its own copy of FDIC fetch or KPI calculation logic. It imports directly:

```js
// side_car/fdicAdapter.js
import { getBankFinancials, getAssetGroupConfig } from '../src/services/fdicService';
import { calculateKPIs } from '../src/utils/kpiCalculator';
import { getProximityScore } from '../src/utils/stateMapping';
```

`getAssetGroupConfig()` is the key shared function — it returns `{ filter, name }` for a given asset size. Both the main app's `getPeerGroupBenchmark()` and the sidecar's `listPeerBanks()` call this function, ensuring the peer group definitions are defined in one place.

---

## Peer Group Algorithm

1. Classify bank by asset size → one of 6 tiers (`< $100M` through `> $250B`).
2. Fetch up to N=500 active FDIC banks in that tier.
3. Deduplicate by CERT (keep first / most recent).
4. Proximity-sort by state distance (same=0, adjacent=1, neighbor-of-neighbor=2, other=3).
5. Slice top 20 as the peer group.
6. Fetch Dec 31 2022 historical data for those 20 — used for 3-year CAGR.
7. Compute **arithmetic mean** of each KPI across the 20 (used as the gauge's `average` marker).
8. Compute **P25 / P75** distributions for all 12 KPIs (used for quartile sector coloring).

> **Why arithmetic mean?** A weighted aggregate would be dominated by the largest bank in the peer group. A simple mean ensures the benchmark value falls naturally between P25 and P75, making gauge positioning intuitive.

---

## Gauge Color Logic

| Mode | Condition | Colors (Left → Right) |
|---|---|---|
| Normal (higher=better) | `inverse=false` | 🔴 Red → 🟡 Yellow → 🟢 Green |
| Inverse (lower=better) | `inverse=true` | 🟢 Green → 🟡 Yellow → 🔴 Red |

**With P25/P75:** Sectors map directly to quartile boundaries (Bottom Q / Middle 50% / Top Q).  
**Without P25/P75:** Equal 3-sector split centered on the average.

---

## Error Handling Philosophy

- **Fail loudly:** Missing data throws visible errors rather than returning silent zeros.
- **Surface to UI:** Errors appear as styled alerts in the UI, not just console logs.
- **No fallback chains:** If `VITE_GEMINI_API_KEY` is missing, the app throws — it does not silently skip AI features.

---

## Build & Run

```bash
# Development (hot reload)
npm run dev

# Production build (both entries)
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

No test command — all test infrastructure was removed in the Feb 2026 cleanup. Build verification (`vite build`) and manual browser testing serve as the quality gate.