# Bank Value Benchmark — Application Specifications

_Last updated: February 2026 — reflects final cleaned-up codebase._

---

## 1. Overview

The **Bank Value Benchmark** is a React-based SPA that helps community banks compare their performance against peer institutions. It provides three primary analytical views:

1. **Financial Health Scorecard**: Automated comparison of 9 financial KPIs against a dynamically-generated peer group derived from live FDIC data (P25/P75 quartiles).
2. **Operational Efficiency Scorecard**: A "Give-to-Get" interactive module where users benchmark operational metrics against industry seed data.
3. **Competitive Radar (Market Movers)**: An integrated view that identifies top QoQ movers within a peer segment and generates an AI-driven competitive briefing via Gemini.

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
| Storage | Vercel KV (Redis) for Quotas |
| Build | Vite SPA (`index.html`) |
| Deployment | Vercel |

---

## 3. Project Structure

```
Benchmark/
├── index.html                   # Main app entry
├── context.md                   # Full feature context
├── blueprint.md                 # Architecture blueprint
├── specifications.md            # Technical specifications
├── todos.md                     # Roadmap and completion status
│
├── api/                         # Vercel Serverless Functions
│   ├── auth/linkedin.js         # LinkedIn Token exchange
│   ├── insights.js              # Gemini API proxy + Quota check
│   └── register.js              # User registration / admin notification
│
├── src/
│   ├── App.jsx                  # Root: search → bank selection → dashboard
│   ├── components/
│   │   ├── auth/
│   │   │   ├── AuthContext.jsx  # Auth provider + OAuth handling
│   │   │   └── LoginModal.jsx   # LinkedIn sign-in UI
│   │   ├── market_movers/
│   │   │   └── market_movers.jsx # Core analysis engine
│   │   ├── BankSearch.jsx
│   │   ├── FinancialDashboard.jsx
│   │   ├── OperationalDashboard.jsx
│   │   ├── GaugeChart.jsx
│   │   ├── MoversSummaryModal.jsx # Competitive intel UI
│   │   ├── PeerGroupModal.jsx
│   │   ├── SummaryModal.jsx     # AI Summarize modal (Gated by Auth)
│   │   └── USMap.jsx
│   │
│   ├── services/
│   │   └── fdicService.js       # FDIC API client
│   └── utils/
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
2. **Select**: App stores `CERT` ID and syncs to `localStorage` for the sidecar.
3. **Financials Fetch**: `getBankFinancials(cert)` fetches last **16 quarters**.
4. **Peer Group**: `getPeerGroupBenchmark()` fetches N=500 candidates, proximity-sorts, and slices top 20.
5. **AI Summarize**: Clicking "AI Summarize" checks auth status, then calls `/api/insights`.

---

## 5. Functional Modules

### 5.1 Market Movers / Competitive Brief (`MoversSummaryModal.jsx`)
- Fetches QoQ deltas for the peer group.
- Computes **Robust Z-Scores** to identify "surprising" performance changes.
- **Drill-down**: Clicking a bank's name in the movers modal triggers a refocus of the main dashboard to that bank.

### 5.2 AI Summary (`SummaryModal.jsx`)
- Requires user to be logged in via LinkedIn.
- Constructs a technical prompt using the bank's KPIs and peer benchmarks.
- Output includes Theme, Confidence, Observations (QoQ), and Strategic Advice.

---

## 6. Design Constraints

- **No backend database**: All persistent state (user counts) is in Vercel KV.
- **Fail loudly**: Missing environment variables or API errors surface immediately to the UI.
- **Proximity-aware peers**: Geographic sorting ensures "local" competition is prioritized in the 20-bank sample.

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
