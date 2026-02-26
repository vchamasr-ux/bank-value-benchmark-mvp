# Top Movers Sidecar — Implementation Checklist

_Status as of February 2026: **COMPLETE**_

---

## Overview

The Market Movers sidecar is a standalone Vite entry point (`side_car/index.html`) that:
- Scans a peer segment (e.g., **Assets > $250B**)
- Finds the **top movers** (positive + negative) based on **QoQ changes** across KPIs
- Generates a concise **movers tape** (delta / delta_pct / z / improving vs deteriorating)
- Sends the tape to Gemini to produce a **competitive briefing**

It was built as a **safe, additive** feature that does **not touch** the main benchmark dashboard code.

---

## Checklist

### Phase 0: Safety & Isolation ✅
- [x] Implemented as a completely separate Vite entry point (`side_car/index.html`)
- [x] Main app entry (`index.html`) is untouched
- [x] No existing components (`FinancialDashboard.jsx`, `OperationalDashboard.jsx`, etc.) were modified
- [x] Sidecar reuses main app services via `fdicAdapter.js` — **no code duplication**

### Phase 1: Data Provider Adapter ✅
- [x] **`side_car/fdicAdapter.js`** implemented as the bridge layer
- [x] Imports `getBankFinancials`, `getAssetGroupConfig` from `src/services/fdicService.js`
- [x] Imports `calculateKPIs` from `src/utils/kpiCalculator.js`
- [x] Imports `getProximityScore` from `src/utils/stateMapping.js`
- [x] Exports `sidecarDataProvider` with:
  - `listPeerBanks({ segmentKey, quarter, focusCert })` — fetches peer list using same proximity-sort logic as main app
  - `getBankKpis({ cert, quarter })` — fetches KPIs and converts from `%` strings to decimals (`0.0132` not `1.32`)
  - `generateGeminiText({ prompt })` — calls Gemini API using `VITE_GEMINI_API_KEY`
- [x] Hard asserts (fail loudly) on missing data throughout adapter

### KPI Key Mapping (Adapter → Sidecar)
| Sidecar Key | Source KPI | Conversion |
|---|---|---|
| `eff_ratio` | `efficiencyRatio` | ÷ 100 |
| `nim` | `netInterestMargin` | ÷ 100 |
| `cost_of_funds` | `costOfFunds` | ÷ 100 |
| `non_int_income_pct` | `nonInterestIncomePercent` | ÷ 100 |
| `loan_yield` | `yieldOnLoans` | ÷ 100 |
| `assets_per_employee` | `assetsPerEmployee` | scalar (no conversion) |
| `roe` | `returnOnEquity` | ÷ 100 |
| `roa` | `returnOnAssets` | ÷ 100 |
| `npl_ratio` | `nonPerformingLoansRatio` | ÷ 100 |
| `asset_growth_3y` | `assetGrowth3Y` | ÷ 100 |
| `loan_growth_3y` | `loanGrowth3Y` | ÷ 100 |
| `deposit_growth_3y` | `depositGrowth3Y` | ÷ 100 |

### Phase 2: Market Movers UI ✅
- [x] **`side_car/market_movers.jsx`** — full QoQ mover analysis
- [x] Segment selector (6 asset class tiers)
- [x] Prior quarter / current quarter selectors
- [x] Focus bank CERT input
- [x] Fetches peer list via `sidecarDataProvider.listPeerBanks()`
- [x] Fetches 2 quarters of KPIs per peer (concurrently)
- [x] Computes deltas, robust z-scores (median/IQR method)
- [x] Computes `delta_pct` (percentile rank among peers)
- [x] Directional scoring (accounts for higher/lower is better per KPI)
- [x] Ranks top N movers by surprise score
- [x] Identifies top 3 driver KPIs per mover
- [x] Builds concise movers tape (text format)
- [x] Copy-to-clipboard button
- [x] "Send to Gemini" button → renders competitive briefing
- [x] Loading / error states surface visibly to UI

### Phase 3: Sidecar Entry Point ✅
- [x] **`side_car/index.html`** — standalone HTML entry
- [x] **`side_car/SidecarApp.jsx`** — React root for sidecar
- [x] `vite.config.js` updated with correct dual-entry config:
  ```js
  input: {
    main: resolve(__dirname, 'index.html'),
    sidecar: resolve(__dirname, 'side_car/index.html'),
  }
  ```
  _(Note: previously had a bug pointing to non-existent `sidecar.html` — fixed Feb 2026.)_

### Phase 4: Gemini Integration ✅
- [x] Uses same Gemini endpoint as `SummaryModal.jsx` in main app (`gemini-2.5-flash`)
- [x] Sends movers tape as the prompt context
- [x] Handles 429 rate limit errors with a user-visible error message (not silent fallback)
- [x] Structured competitive briefing prompt: "what changed / so what / what should [bank] do / watch next quarter"

---

## Acceptance Criteria Status

| Criterion | Status |
|---|---|
| Existing benchmark pages unchanged | ✅ |
| Sidecar loads peer set for a segment | ✅ |
| Tape generation completes without errors | ✅ |
| Top movers list changes when quarters/segment change | ✅ |
| Copy tape works | ✅ |
| Send to Gemini returns narrative briefing | ✅ |
| Missing KPI fails loudly (assert) | ✅ |
| Rate format error (>1.0 for rate) would throw | ✅ |

---

## No Longer Needed / Removed

- ~~`VITE_FEATURE_MOVERS` feature flag~~ — Sidecar is a separate URL (`/side_car/index.html`), so no flag is needed. Access is controlled by whether you link to it.
- ~~`src/services/moversDataProvider.js`~~ — The adapter lives directly in `side_car/fdicAdapter.js` to keep the sidecar self-contained.

---

## Future Enhancements

- [ ] In-memory / `localStorage` caching for `(cert, quarter)` KPI fetches (reduces API load when re-selecting the same segment/quarters)
- [ ] Option 3: "Respond as [Bank]" — playbook mining from historical analog quarters
- [ ] Configurable `topN` movers display
- [ ] Exportable competitive briefing (PDF or email format)
