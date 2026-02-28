# Bank Value Benchmark — Architecture Blueprint

_Last updated: February 2026 — reflects current built state._

---

## Application Overview

**Architecture:** Single Page Application (SPA) with serverless API proxies for Auth, AI, and Brief Storage.

**Frontend:** React 19 + Vite 7 + TailwindCSS 4.x

**Visualization:** Recharts (`PieChart` for gauge, `LineChart` for sparklines)

**Data Source A (Financials):** FDIC BankFind API — real-time public data, no API key required.

**Data Source B (Operational):** `src/data/operationalBenchmarks.json` — static seed benchmarks + user inputs.

**Data Source C (AI Layer):** Gemini API (`gemini-2.5-flash`) via serverless proxy (`/api/insights.js`).

**Authentication:** LinkedIn OAuth2 (Authorization Code Flow) + Vercel KV for quota persistence.

**Storage:** Vercel KV (Redis) for daily AI quotas and saved AI briefs.

**State Management:** Component-local React state + `AuthContext` for user session.

---

## Single Entry Point

| Entry | URL | Purpose |
|---|---|---|
| `index.html` | `http://localhost:5173/` | Main benchmark app |

Standard Single Page Application (SPA) — no multiple routes.

---

## Technical Stack & Infrastructure

- **UI Framework**: React 19 (Hooks, Context)
- **Styling**: TailwindCSS 4.x
- **Charts**: Recharts
- **PDF Export**: `react-to-print` (hidden off-screen `PrintContainer`)
- **Backend (Serverless)**:
  - Vercel Serverless Functions (`api/*.js`)
  - **Vercel KV**: Redis-based storage for user registration, daily quotas, and saved AI briefs.
- **Identity**: LinkedIn OAuth 2.0
- **AI**: Google Gemini 2.5 Flash

---

## Phase-by-Phase Journey

### Phase 1: Real Data Pipeline
Get the bank `CERT` ID → fetch 16 quarters of Call Report data → run through `kpiCalculator.js`.

### Phase 2: Visualization
Turn raw KPIs into gauges with peer-aware coloring, interactive sparklines, and quartile tooltips.

### Phase 3: Dynamic Peer Benchmarks
Automatically find 20 peer banks in the same asset class and near the same geography.

### Phase 4: Operational "Give-to-Get"
Unlock operational gauges by submitting your own bank's data.

### Phase 5: AI Summarize & Market Movers
One-click Gemini narrative (Summary Modal) and competitive radar (Market Movers Modal). Both utilize `gemini-2.5-flash` to synthesize complex FDIC tape data into actionable strategic insights.

### Phase 6: Authentication & Quota Control
Implemented LinkedIn Login to gate AI features and managed a daily quota using Vercel KV.

### Phase 7–8: UX Polish
Landing page, dashboard skeleton, shared components (`Tooltip`, `Sparkline`), user profile menu, gauge tooltip corrections.

### Phase 9: PDF Export
`react-to-print` pipeline; 4 print slides hidden off-screen, triggered via "Export PDF" button.

### Phase 10: Pitchbook Presentation Mode
5-slide full-screen IB deck. Keyboard navigation. Reuses `MoversView` + `StrategicPlannerTab` in scaled embed mode. Pulls AI insights from `localStorage` cache.

### Phase 11: Save Briefs
`api/briefs.js` (GET/POST/DELETE via Vercel KV), "Save Brief" added to `SummaryModal` and `MoversSummaryModal`, `SavedBriefsModal` accessible from the user profile menu.

### Phase 12: HTML Export
`exportHtmlBrief.js` utility generates a self-contained styled `.html` file from AI summary + financials data, auto-downloaded by the browser.

---

## Authentication Flow

1. **Initiate**: User clicks "Login with LinkedIn" → redirects to LinkedIn with `state` and `code_challenge`.
2. **Callback**: LinkedIn redirects back to `/` with a `code`.
3. **Exchange**: `AuthContext` sends the code to `/api/auth/linkedin`.
4. **Registration**: Server function checks Vercel KV for existing registration; if new, prompts for profile/consent and notifies admin via `/api/register`.
5. **Session**: User data is saved in `localStorage` and React state.

---

## Quota Management (Vercel KV)

- **Key Strategy**: `quota:<linkedin_sub>:<YYYY-MM-DD>`
- **Logic**: Every request to `/api/insights` increments the daily key. If `count >= 2`, returns 429.
- **Exceptions**: Admin users (listed in `ADMIN_LINKEDIN_SUBS` environment variable) bypass the quota.
- **Retry UX**: `SummaryModal` detects a Gemini-level `429` (rate limit) vs. a daily quota `429`, with auto-retry countdown for the former.

---

## Saved Briefs (Vercel KV)

- **Key Strategy**: `briefs:<linkedin_sub>` (Redis hash)
- **Schema**: Each field in the hash is a `briefId` (timestamp + random suffix). Value is a JSON object `{ id, bankName, type, date, data }`.
- **Types**: `financial_summary` (from SummaryModal) and `competitive_brief` (from MoversSummaryModal).
- **Endpoint**: `api/briefs.js` — supports GET (list), POST (save), DELETE (delete by id).

---

## Build & Run

```bash
# Development (hot reload)
npm run dev

# Production build
npm run build
```

No test command — all test infrastructure was removed in the Feb 2026 cleanup. Verification is done via build checks (`vite build`) and manual browser testing.
