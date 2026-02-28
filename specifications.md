# Bank Value Benchmark — Application Specifications

_Last updated: February 2026 — reflects current codebase._

---

## 1. Overview

The **Bank Value Benchmark** is a React-based SPA that helps community banks compare their performance against peer institutions. It provides the following analytical views:

1. **Financial Health Scorecard**: Automated comparison of 9 financial KPIs against a dynamically-generated peer group derived from live FDIC data (P25/P75 quartiles).
2. **Operational Efficiency Scorecard**: A "Give-to-Get" interactive module where users benchmark operational metrics against industry seed data.
3. **Competitive Radar (Market Movers)**: Identifies top QoQ movers within a peer segment and generates an AI-driven competitive briefing via Gemini.
4. **Pitchbook Presentation Mode**: A 5-slide full-screen IB-style presentation rendering the bank's benchmarks, AI insights, and market positioning.
5. **PDF Export**: A `react-to-print`-based pipeline producing a 4-slide printer-ready PDF.
6. **AI Brief Management**: Save, list, and delete AI-generated briefs (financial summaries and competitive briefs) stored in Vercel KV.

---

## 2. Technical Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React 19 + Vite 7 |
| Styling | TailwindCSS 4.x (Utility-first) |
| Visualization | Recharts (PieChart gauge, LineChart sparkline) |
| Data Source | FDIC Public API (`https://banks.data.fdic.gov/`) — client-side |
| AI Layer | Gemini API (`gemini-2.5-flash`) via serverless proxy |
| Auth Layer | LinkedIn OAuth 2.0 |
| Storage | Vercel KV (Redis) for Quotas + Saved Briefs |
| PDF Export | `react-to-print` |
| Build | Vite SPA (`index.html`) |
| Deployment | Vercel |

---

## 3. Project Structure

```
Benchmark/
├── index.html                   # Main app entry
├── context.md                   # Full feature context
├── blueprint.md                 # Architecture blueprint
├── specifications.md            # Technical specifications (this file)
├── todos.md                     # Roadmap and completion status
│
├── api/                         # Vercel Serverless Functions
│   ├── auth/linkedin.js         # LinkedIn Token exchange
│   ├── insights.js              # Gemini API proxy + Quota check
│   ├── briefs.js                # Save/list/delete AI briefs (Vercel KV)
│   └── register.js              # User registration / admin notification
│
├── src/
│   ├── App.jsx                  # Root: search → bank selection → dashboard
│   ├── components/
│   │   ├── auth/
│   │   │   ├── AuthContext.jsx  # Auth provider + OAuth handling
│   │   │   └── LoginModal.jsx   # LinkedIn sign-in UI
│   │   ├── pdf/                 # react-to-print PDF slide components
│   │   │   ├── PrintContainer.jsx
│   │   │   ├── Slide1_CoreMetrics.jsx
│   │   │   ├── Slide2_Returns.jsx
│   │   │   ├── Slide3_ExecutiveSummary.jsx
│   │   │   └── Slide4_PeerGroup.jsx
│   │   ├── BankSearch.jsx
│   │   ├── FinancialDashboard.jsx
│   │   ├── FinancialDashboardSkeleton.jsx  # Loading skeleton
│   │   ├── GaugeChart.jsx
│   │   ├── LandingPage.jsx                 # Pre-search entry experience
│   │   ├── MoversSummaryModal.jsx          # Competitive intel UI + Save Brief
│   │   ├── MoversView.jsx                  # Movers table/scatter (also in Pitchbook)
│   │   ├── OperationalDashboard.jsx
│   │   ├── PeerGroupModal.jsx
│   │   ├── PitchbookPresentation.jsx       # 5-slide IB deck (full-screen)
│   │   ├── SavedBriefsModal.jsx            # My Briefs list modal
│   │   ├── Sparkline.jsx                   # Reusable inline sparkline
│   │   ├── StrategicPlannerTab.jsx
│   │   ├── SummaryModal.jsx                # AI Summarize (+ Save/Export)
│   │   ├── Tooltip.jsx                     # Shared tooltip component
│   │   ├── TrendIndicator.jsx
│   │   ├── TrendSparkline.jsx
│   │   ├── UserProfileMenu.jsx             # Avatar, Saved Briefs, Logout
│   │   └── USMap.jsx
│   │
│   ├── services/
│   │   └── fdicService.js       # FDIC API client
│   └── utils/
│       ├── exportHtmlBrief.js   # Standalone HTML executive brief generator
│       ├── kpiCalculator.js     # Financial formulas
│       └── stateMapping.js      # US State adjacency
```

---

## 4. Core Architecture & Data Flow

### 4.1 Authentication & Quota Flow
- **LinkedIn OAuth**: Users authenticate via LinkedIn. The `AuthContext` manages the session via `localStorage`.
- **Daily Quota**: The `/api/insights.js` endpoint checks Vercel KV before making a Gemini call. Users are limited to **2 calls per day**.
- **Admin Bypass**: Users listed in `ADMIN_LINKEDIN_SUBS` bypass the quota.

### 4.2 Main App Data Flow
1. **Search**: `searchBank()` queries FDIC `institutions` endpoint.
2. **Select**: App stores `CERT` ID and fetches financials + peer benchmarks.
3. **Financials Fetch**: `getBankFinancials(cert)` fetches last **16 quarters**.
4. **Peer Group**: `getPeerGroupBenchmark()` fetches N=500 candidates, proximity-sorts, and slices top 20.
5. **AI Summarize**: Clicking "AI Summarize" checks auth status, then calls `/api/insights`.
6. **Save Brief**: Clicking "Save Brief" in SummaryModal or MoversSummaryModal POSTs to `/api/briefs`.

### 4.3 PDF Export Flow
1. `PrintContainer` renders 4 slides off-screen using `position: absolute; top: -9999px`.
2. The "Export PDF" button triggers `react-to-print` to print the container contents.
3. AI summary text is passed in as a prop (`aiSummary`) from App state.

### 4.4 Pitchbook Flow
1. "Pitchbook" button in `FinancialDashboard` opens `PitchbookPresentation` as a `z-[200]` overlay.
2. Component reads cached AI summary from `localStorage` (key: `benchmark_summary_<CERT>`).
3. Slides 4 and 5 re-use `MoversView` and `StrategicPlannerTab` with `isPresentationMode` prop.

---

## 5. Functional Modules

### 5.1 Market Movers / Competitive Brief (`MoversSummaryModal.jsx`)
- Fetches QoQ deltas for the peer group.
- Computes **Robust Z-Scores** to identify "surprising" performance changes.
- **Drill-down**: Clicking a bank's name in the movers modal triggers a refocus of the main dashboard.
- **Save Brief**: Users can save the competitive brief via `POST /api/briefs` (type: `competitive_brief`).

### 5.2 AI Summary (`SummaryModal.jsx`)
- Requires user to be logged in via LinkedIn.
- Constructs a technical prompt using the bank's KPIs and peer benchmarks.
- Auto-retries on Gemini rate limit with animated countdown.
- Actions: Copy | Export HTML | Save Brief | Regenerate.

### 5.3 Saved Briefs (`SavedBriefsModal.jsx` + `api/briefs.js`)
- Stores all briefs in Vercel KV under hash key `briefs:<linkedin_sub>`.
- Supports GET (list all), POST (new brief), DELETE (remove by id).
- Results sorted newest-first.

### 5.4 PDF Export (`src/components/pdf/`)
- `PrintContainer` assembles 4 slides as a hidden DOM tree.
- Each slide is a fixed `1100×619px` (16:9) page-break-separated component.
- Slide 3 embeds the AI summary as formatted text.
- Slide 4 embeds the full peer group list.

### 5.5 Pitchbook Presentation (`PitchbookPresentation.jsx`)
- 5-slide IB deck rendered as a full-screen `fixed` overlay.
- Slide 2 auto-extracts bullet points from the cached AI summary markdown.
- Each bullet is matched to a relevant KPI using keyword heuristics, then a matching `Sparkline` is rendered inline.
- Keyboard: `→` / `Space` → next, `←` → prev, `Escape` → close.

---

## 6. Design Constraints

- **No backend database**: All persistent state (user counts, briefs) is in Vercel KV.
- **Fail loudly**: Missing environment variables or API errors surface immediately to the UI.
- **Proximity-aware peers**: Geographic sorting ensures "local" competition is prioritized in the 20-bank sample.
- **Auth-gated AI**: All Gemini calls require a valid LinkedIn session (except local dev with `VITE_GEMINI_API_KEY`).

---

## 7. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Server-side key for AI generation |
| `LINKEDIN_CLIENT_ID` | Yes | LinkedIn OAuth ID |
| `LINKEDIN_CLIENT_SECRET` | Yes | LinkedIn OAuth secret |
| `KV_URL` | Yes | Vercel KV (Redis) connection URL |
| `ADMIN_LINKEDIN_SUBS` | No | Comma-separated LinkedIn IDs for unlimited quota |
| `RESEND_API_KEY` | No | For registration notifications |
| `VITE_GEMINI_API_KEY` | Dev only | Client-side Gemini key for local dev without auth |
