# Value Benchmark MVP — Full Feature Context

**Purpose**: Real-time FDIC financial benchmarking and competitive intelligence tool for U.S. banks. Built for senior bankers and analysts.

**Stack**: React (Vite), Tailwind CSS, FDIC Public API, Google Gemini AI, LinkedIn OAuth, Redis  
**Deployment**: Vercel  
**Data source**: FDIC public API — all data is live, no mock data, no backend (serverless functions used for Auth/Proxy)

---

## 1. Authentication & Registration (LinkedIn Login)

- **Official LinkedIn Integration**: Users must sign in via LinkedIn to access AI features.
- **Registration Flow**: New users provide their LinkedIn profile URL and consent to professional outreach.
- **Admin Approval**: Registration notifies the admin for record-keeping (via `api/register.js`).
- **Usage Quota**: Standard users are limited to **2 AI generation calls per day** (tracked via Redis). Admin users (configured via `ADMIN_LINKEDIN_SUBS` environment variable) have unlimited access.
- **User Profile Menu**: `UserProfileMenu.jsx` renders the logged-in user's name/avatar, a "My Saved Briefs" button, and a logout option in the top-right of the app header.

---

## 2. Landing Page

- `LandingPage.jsx` is the authenticated entry gate for the app.
- Shown before a bank is selected; introduces the product and the LinkedIn login CTA.
- Once a bank is selected via `BankSearch`, the app transitions to the full dashboard.

---

## 3. Bank Search

- Full-text search across all FDIC-registered institutions by name.
- Results show bank name, city, state, and CERT number.
- On selection, the app fetches 5 quarters of historical financials for that bank.

---

## 4. Financial Health Scorecard (Main Dashboard)

Displays **9 KPIs** as interactive gauge charts, each benchmarked against a dynamically-fetched peer group:

| KPI | Direction |
|---|---|
| Efficiency Ratio | Lower is better |
| Net Interest Margin (NIM) | Higher is better |
| Cost of Funds | Lower is better |
| Non-Interest Income % | Higher is better |
| Yield on Loans | Higher is better |
| Assets per Employee ($M) | Higher is better |
| Return on Equity (ROE) | Higher is better |
| Return on Assets (ROA) | Higher is better |
| NPL Ratio | Lower is better |

**Gauge charts show:**
- Bank's current value (needle)
- Peer group arithmetic mean (benchmark line)
- P25–P75 interquartile range (shaded visual band on the gauge)
- Trend sparkline (last 5 quarters of YoY data)
- Contextual tooltips: describe each metric and its peer quartile standing (e.g., "Top Quartile", "Below Median"). Tooltip logic correctly inverts for "lower is better" metrics.

**Loading state**: `FinancialDashboardSkeleton.jsx` renders animated placeholder cards while data is fetching.

---

## 5. 3-Year Growth Performance (CAGR)

Three additional gauges displayed separately:

| Metric | Notes |
|---|---|
| Asset Growth (3Y CAGR) | % |
| Loan Growth (3Y CAGR) | % |
| Deposit Growth (3Y CAGR) | % |

Also includes YoY trendlines for the past 3 years to show growth momentum. Peer group arithmetic mean used (not weighted) to avoid skew from incomplete historical data.

---

## 6. Dynamic Peer Group Benchmarking

- Peer group is determined automatically from the selected bank's **total assets** (size tier) and **state** (geographic proximity).
- Asset tiers: Community ($300M–$1B), Mid-size ($1B–$10B), Regional ($10B–$100B), Large ($100B+).
- Geographic proximity scoring prioritizes same-state peers, then neighboring states.
- Benchmarks recalculate automatically when a new bank is selected.
- Peer group label displays next to the dashboard header (e.g., "Benchmark: Regional Bank Peer Group").
- Sample size is clickable → opens Peer Group Modal.

---

## 7. Peer Group Modal

- Lists all banks in the current peer group.
- Shows name, state, and asset size for each peer.
- Visual indicator of geographic proximity to the selected bank.

---

## 8. AI Summary ("AI Summarize" button)

- Triggers a Gemini API call with the selected bank's KPIs and benchmarks as context.
- **Requires Authentication**: User must be logged in.
- Generates a structured financial performance narrative (strengths, weaknesses, forward-looking signals).
- Includes contextual introduction about the bank (uses Gemini's external knowledge for background).
- On rate limit (429), auto-retries with a visible countdown timer.
- **Actions available after generation:**
  - **Copy Report**: Copies raw markdown to clipboard.
  - **Export HTML Brief**: Downloads a standalone, styled `.html` executive brief (via `exportHtmlBrief.js` utility).
  - **Save Brief**: Posts to `/api/briefs` to persist the brief to Redis under the user's LinkedIn sub.
  - **Regenerate**: Re-triggers the Gemini call.

---

## 9. Saved Briefs (`SavedBriefsModal.jsx` + `api/briefs.js`)

- Accessible via the **"My Saved Briefs"** button in the UserProfileMenu.
- Lists all previously saved AI Financial Summaries and Competitive Briefs for the logged-in user.
- Each entry shows bank name, type, date, and a preview of the content.
- Users can **delete** individual briefs.
- Backed by Redis using a Redis hash per user: `briefs:<linkedin_sub>`.

---

## 10. Operational Efficiency Dashboard

A second dashboard section below the financial scorecard:

- **Gated by user data entry**: user enters their own operational figures to unlock the comparison.
- Metrics benchmarked against industry static data:
  - Digital Adoption Rate (%)
  - Digital Account Opening (%)
  - Vendor Spend (% of OpEx)
  - Average Age of Customer (years)
  - Net Promoter Score (NPS)
- Gauges are blurred/locked until the user submits their data.

---

## 11. Market Movers / Competitive Brief

A competitive intelligence layer built on top of the benchmark data.

### Entry Point
- **"📊 Competitive Brief →" button** appears on the bank dashboard after financials + benchmarks load.
- Opens as a **modal overlay** (`MoversSummaryModal.jsx`) centering the focus on the intelligence brief.

### What it does
- Fetches the same peer group as the main dashboard.
- Computes **QoQ deltas** (Q3 2025 → Q4 2025) for all 12 KPIs across all peers.
- Ranks peers by **"surprise score"** (sum of absolute robust z-scores) — most surprising movers ranked first.
- Displays top 5 movers with their top 3 driver KPIs and direction (positive/negative).
- **Drill-down support**: Clicking a mover bank's name in the brief instantly switches the main dashboard to that bank's detailed benchmarks.
- Handles peers with missing data gracefully: skips them, shows a warning, requires ≥5 complete peers.

### Perspective Bank Snapshot
- When the focus bank's data is available, a **"📎 Posture:" field** appears pre-filled with an auto-inferred strategic posture.
- User can edit or clear the posture before sending to Gemini.
- The snapshot (6 KPIs with peer medians and quartile labels) is appended to the Gemini prompt to personalize the competitive advice.

### Gemini Analysis
- "Analyze with Gemini" button sends the tape + snapshot to Gemini 2.5 Flash.
- **Requires Authentication**: Subject to the 2x/day daily quota.
- Also supports **Save Brief** from within the movers modal (saved to `/api/briefs` as type `competitive_brief`).
- Output format per competitor bank: Theme + classification (Threat / Opportunity / Monitor), Confidence, QoQ observations, competitive posture, recommended actions, and watch signals.

---

## 12. Pitchbook Presentation Mode (`PitchbookPresentation.jsx`)

A full-screen, IB-style slide deck presentation built in React.

- **Entry**: "Pitchbook" button on the main dashboard.
- **5 slides:**
  1. **Cover** — Bank name, location, date.
  2. **Strategic Summary & Key Insights** — Pulls top bullet points from the cached AI summary and renders matching sparkline charts inline per insight.
  3. **Core Financial Performance** — 6 gauge charts (ROE, ROA, Efficiency, NIM, Asset Growth 3Y, NPL Ratio) vs. peer group.
  4. **Market Positioning & Peer Distribution** — Embeds `MoversView` in presentation mode (limited rows, no drill-down).
  5. **Forward-Looking Strategy & Rate Shock** — Embeds `StrategicPlannerTab` in a scaled-down view.
- **Navigation**: Arrow/Space keyboard shortcuts, Prev/Next buttons.
- **Exit**: Escape key or "Close Presentation" button.
- IB-standard branding footer: "STRICTLY CONFIDENTIAL" disclaimer + bank name.

---

## 13. PDF Export (`src/components/pdf/`)

A print-to-PDF pipeline using `react-to-print`.

- **Trigger**: "Export PDF" button on the main dashboard.
- **PrintContainer** (`PrintContainer.jsx`): Off-screen rendered container holding 4 print slides, passed by ref to `react-to-print`.
- **Slide 1** (`Slide1_CoreMetrics.jsx`): Core financial KPI gauges.
- **Slide 2** (`Slide2_Returns.jsx`): Returns and yield metrics.
- **Slide 3** (`Slide3_ExecutiveSummary.jsx`): AI-generated executive summary narrative.
- **Slide 4** (`Slide4_PeerGroup.jsx`): Peer group list and asset tier information.
- Each slide matches IB presentation standards: 16:9 ratio, blue branding strip, confidentiality footer.

---

## Technical Notes

| Item | Detail |
|---|---|
| Data freshness | FDIC Q4 2025 data available; Q1 2026 not yet published |
| Quarters analyzed | Q3 2025 (prior) vs Q4 2025 (current) — hardcoded for now |
| Peer count | Typically N=18–22 after filtering for complete data |
| KPI computation | `calculateKPIs()` in `kpiCalculator.js` — all from FDIC public fields |
| Gemini model | `gemini-2.5-flash` via REST API |
| Quota Management | Redis storing daily counts per LinkedIn Sub |
| Brief Storage | Redis hash `briefs:<sub>` for saved AI briefs |
| Security | LinkedIn OAuth2 authorization code flow with server-side secret |
| HTML Export | `src/utils/exportHtmlBrief.js` generates a self-contained styled HTML file |

---

## What's NOT in the app (yet)

- No quarter selector (Q3→Q4 2025 is hardcoded).
- Operational dashboard uses static industry benchmarks (not FDIC live data).
- No in-memory or localStorage caching for FDIC peer KPI fetches (each load re-fetches).
- Pitchbook PDF print flow does not yet include the Market Movers or Pitchbook Presentation slides (only the 4 `src/components/pdf/` slides).
