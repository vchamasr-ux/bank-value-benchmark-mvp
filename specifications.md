# Bank Value Benchmark — Application Specifications

_Last updated: February 2026 — reflects final cleaned-up codebase._

---

## 1. Overview

The **Bank Value Benchmark** is a React-based SPA that helps community banks compare their performance against peer institutions. It provides two primary analytical views:

1. **Financial Health Scorecard**: Automated comparison of 9 financial KPIs against a dynamically-generated peer group derived from live FDIC data (P25/P75 quartiles).
2. **Operational Efficiency Scorecard**: A "Give-to-Get" interactive module where users benchmark operational metrics against industry seed data.
3. **Market Movers Sidecar**: A companion page (`/side_car/index.html`) that identifies top QoQ movers within a peer segment and generates an AI-driven competitive briefing via Gemini.

---

## 2. Technical Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React 19 + Vite 7 |
| Styling | TailwindCSS 4.x (Utility-first) |
| Visualization | Recharts (PieChart gauge, LineChart sparkline) |
| Data Source | FDIC Public API (`https://banks.data.fdic.gov/`) — client-side only, no backend |
| AI Layer | Gemini API (`gemini-2.5-flash`) via `VITE_GEMINI_API_KEY` |
| Build | Vite multi-entry build (`index.html` + `side_car/index.html`) |
| Deployment | Vercel |

> **Note:** No test framework is included. The `vitest` / `@testing-library/*` / `jsdom` dependencies and all `.test.*` files were removed during the Feb 2026 cleanup. Verification is done via build checks (`vite build`) and manual browser tests.

---

## 3. Project Structure

```
Benchmark/
├── index.html                   # Main app entry
├── vite.config.js               # Dual-entry build config
├── package.json                 # Dependencies (no test scripts)
├── .env.local                   # VITE_GEMINI_API_KEY (not committed)
│
├── src/
│   ├── App.jsx                  # Root: search → bank selection → dashboard
│   ├── main.jsx
│   ├── index.css
│   │
│   ├── services/
│   │   └── fdicService.js       # searchBank(), getBankFinancials(),
│   │                              getPeerGroupBenchmark(), getAssetGroupConfig()
│   ├── utils/
│   │   ├── kpiCalculator.js     # calculateKPIs(), formatQuarter()
│   │   └── stateMapping.js      # ADJACENT_STATES map, getProximityScore()
│   │
│   ├── components/
│   │   ├── BankSearch.jsx
│   │   ├── FinancialDashboard.jsx
│   │   ├── OperationalDashboard.jsx
│   │   ├── GaugeChart.jsx       # Gauge + needle + P25/P75 zones
│   │   ├── TrendIndicator.jsx   # QoQ arrow indicator (hover triggers sparkline)
│   │   ├── TrendSparkline.jsx   # Mini LineChart popup (used inside TrendIndicator)
│   │   ├── PeerGroupModal.jsx   # Modal listing the 20 peer banks + USMap
│   │   ├── SummaryModal.jsx     # AI Summarize modal (Gemini integration)
│   │   └── USMap.jsx            # Tile-grid US state map (used in PeerGroupModal)
│   │
│   └── data/
│       └── operationalBenchmarks.json  # Seed benchmarks for Operational section
│
└── side_car/
    ├── index.html               # Sidecar entry point
    ├── SidecarApp.jsx           # Sidecar root
    ├── market_movers.jsx        # Market Movers UI (tape + Gemini briefing)
    ├── fdicAdapter.js           # Bridge: wraps src/ services for the sidecar
    └── *.md                     # Sidecar blueprint & implementation docs
```

---

## 4. Core Architecture

The application runs entirely client-side. State is managed in React component state — no Redux, no Context API.

### 4.1 Main App Data Flow

1. **Search**: User types a bank name → `searchBank()` queries FDIC `institutions` endpoint.
2. **Select**: User picks a bank → app has the `CERT` ID.
3. **Financials Fetch**: `getBankFinancials(cert)` fetches the last **16 quarters** of Call Report data (needed for 3-year CAGR calculations).
4. **KPI Calculation**: `calculateKPIs(bankData)` produces formatted KPIs + YoY annual growth history for each quarter.
5. **Peer Group**:
   - `getAssetGroupConfig(asset)` determines the asset class filter & group name (shared function — used by both `fdicService.js` and `side_car/fdicAdapter.js`).
   - `getPeerGroupBenchmark()` fetches N=500 candidates, deduplicates by CERT, proximity-sorts by state adjacency, slices top 20, and computes **P25/P75 distributions + arithmetic means** across all 12 KPIs.
6. **Render**: `FinancialDashboard` and `OperationalDashboard` receive props and render `GaugeChart` instances.

### 4.2 Peer Group Benchmark Logic

- **Asset Classes** (in thousands): `< $100M`, `$100M–$1B`, `$1B–$10B`, `$10B–$50B`, `$50B–$250B`, `> $250B`.
- **Proximity Sort**: Peers are ranked — same state (0), adjacent state (1), neighbor-of-neighbor (2), national (3).
- **Benchmark Value**: **Arithmetic mean** (not weighted aggregate) of each KPI across the 20 peers.
- **Historical Baseline**: A second FDIC query fetches Dec 31 2022 data for the 20 peers to calculate 3-year CAGR growth metrics.

---

## 5. Functional Modules

### 5.1 Bank Search (`BankSearch.jsx`)
- Free-text search → FDIC `institutions` endpoint with `ACTIVE:1` filter.
- Results sorted by Asset size (DESC) — largest bank first.
- Error state surfaces as a visible alert (not a console log).

### 5.2 Financial Health Scorecard (`FinancialDashboard.jsx`)
Nine KPIs, each rendered as a `GaugeChart` with P25/P75 quartile zones:

| # | Metric | Direction | Formula |
|---|---|---|---|
| 1 | **Efficiency Ratio** | Lower is Better | `NONIX / (INTINC - INTEXP + NONII)` |
| 2 | **Net Interest Margin** | Higher is Better | `(INTINC - INTEXP) / ASSET` |
| 3 | **Cost of Funds** | Lower is Better | `INTEXP / ASSET` |
| 4 | **Non-Interest Income %** | Higher is Better | `NONII / Total Income` |
| 5 | **Yield on Loans** | Higher is Better | `INTINC / LNLSNET` |
| 6 | **Assets / Employee** | Higher is Better | `(ASSET × 1000) / NUMEMP` |
| 7 | **Return on Equity** | Higher is Better | `NETINC / EQ` |
| 8 | **Return on Assets** | Higher is Better | `NETINC / ASSET` |
| 9 | **NPL Ratio** | Lower is Better | `NCLNLS / LNLSNET` |

**Growth Section** (above the 9 KPIs): 3-year CAGR for Asset, Loan, and Deposit growth — also visualized as `GaugeChart` with peer quartile zones.

**Trend Indicators**: Each gauge shows a QoQ arrow (`TrendIndicator`). Hovering reveals a mini `TrendSparkline` — 4-quarter trend for standard KPIs, or 3-year YoY annual points for growth KPIs.

**Peer Group Modal**: Clickable `(N=20)` badge opens `PeerGroupModal`, which lists all 20 peer banks with a `USMap` showing geographic distribution.

**AI Summarize**: Button opens `SummaryModal`, which constructs a structured prompt and sends financials + benchmarks to Gemini for a narrative report.

### 5.3 Operational Efficiency Scorecard (`OperationalDashboard.jsx`)
- **Locked State**: Blurred overlay with "Unlock Your Full Scorecard" CTA.
- User enters 5 operational metrics → clicking "Compare My Bank" removes overlay.
- Gauges compare user input vs. seed data from `operationalBenchmarks.json`.

| Metric | Benchmark (seed) | Direction |
|---|---|---|
| Digital Adoption Rate | 60% | Higher is Better |
| Digital Account Opening | 25% | Higher is Better |
| Vendor Spend (% of OpEx) | 12% | Lower is Better |
| Avg Age of Customer | 52 yrs | Lower is Better |
| Net Promoter Score | 50 | Higher is Better |

### 5.4 GaugeChart (`GaugeChart.jsx`)
- Built on Recharts `PieChart` (semi-circle, 180°→0°).
- **Method 2 (default when P25/P75 available)**: 3 colored sectors map directly to quartile zones — Bottom Q / Middle 50% / Top Q.
- **Method 1 (fallback)**: Equal 3-sector split centered on the Average.
- Needle rotates to `value` position. Color logic auto-inverts for "lower is better" metrics.

---

## 6. FDIC Call Report Fields Used

| Field | Description |
|---|---|
| `REPDTE` | Report Date (YYYYMMDD) |
| `ASSET` | Total Assets (× $1,000) |
| `DEP` | Total Deposits |
| `NUMEMP` | Full-time equivalent employees |
| `INTINC` | Total Interest Income |
| `INTEXP` | Total Interest Expense |
| `EINTEXP` | Estimated Interest Expense (fallback) |
| `NONII` | Non-Interest Income |
| `NONIX` | Non-Interest Expense |
| `LNLSNET` | Net Loans and Leases |
| `NETINC` | Net Income |
| `EQ` | Total Equity Capital |
| `NCLNLS` | Non-Current Loans and Leases |
| `STALP` | State Abbreviation |

---

## 7. Sidecar (`side_car/`)

The Market Movers sidecar is a **standalone Vite entry point** (`side_car/index.html`) that runs at `/side_car/index.html`.

- **`fdicAdapter.js`**: The bridge between the sidecar and the main app's services. Imports `getBankFinancials`, `getAssetGroupConfig` from `src/services/fdicService.js` and `calculateKPIs` from `src/utils/kpiCalculator.js`. **No code is duplicated** — asset class logic is shared via `getAssetGroupConfig()`.
- **`market_movers.jsx`**: Full QoQ mover analysis UI — fetches two quarters of peer KPIs, computes delta/z-scores, builds the movers tape, and sends it to Gemini.
- **`SidecarApp.jsx`**: Sidecar React root.

---

## 8. Key Design Decisions

- **No backend**: All FDIC queries run client-side. No server, no proxy.
- **Fail loudly**: Missing data throws visible errors rather than silently returning zeros.
- **No mock data**: The app always talks to the live FDIC API.
- **Shared asset class logic**: `getAssetGroupConfig()` is exported from `fdicService.js` and imported by both the main app and the sidecar — keeping peer group definitions in one place.
- **Arithmetic mean for benchmarks**: Peer averages are computed as simple means (not weighted aggregates) to ensure the benchmark value falls within the P25–P75 range and isn't skewed by outliers.

---

## 9. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_GEMINI_API_KEY` | Yes | Gemini API key for AI Summarize + Sidecar Gemini calls |

Set in `.env.local` (never committed to git).

---

## 10. Known Constraints

- **FDIC Rate Limits**: The public API may throttle heavy use. No caching layer currently exists.
- **16-Quarter Limit**: The app fetches at most 16 quarters. 3-year CAGR requires ≥ 13 quarters — banks with shorter history will have `null` for growth KPIs.
- **N=20 Peer Sample**: The peer group is proximity-sorted and capped at 20 — small enough for fast rendering but statistically limited for very large asset classes.
