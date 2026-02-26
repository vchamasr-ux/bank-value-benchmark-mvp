# Value Benchmark MVP — Full Feature Context

**Purpose**: Real-time FDIC financial benchmarking and competitive intelligence tool for U.S. banks. Built for senior bankers and analysts.

**Stack**: React (Vite), Tailwind CSS, FDIC Public API, Google Gemini AI, LinkedIn OAuth, Vercel KV  
**Deployment**: Vercel  
**Data source**: FDIC public API — all data is live, no mock data, no backend (serverless functions used for Auth/Proxy)

---

## 1. Authentication & Registration (LinkedIn Login)

- **Official LinkedIn Integration**: Users must sign in via LinkedIn to access AI features.
- **Registration Flow**: New users provide their LinkedIn profile URL and consent to professional outreach.
- **Admin Approval**: Registration notifies the admin for record-keeping.
- **Usage Quota**: Standard users are limited to **2 AI generation calls per day** (tracked via Vercel KV). Admin users (configured via environment variables) have unlimited access.

---

## 2. Bank Search

- Full-text search across all FDIC-registered institutions by name
- Results show bank name, city, state, and CERT number
- On selection, the app fetches 5 quarters of historical financials for that bank

---

## 3. Financial Health Scorecard (Main Dashboard)

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

---

## 4. 3-Year Growth Performance (CAGR)

Three additional gauges displayed separately:

| Metric | Notes |
|---|---|
| Asset Growth (3Y CAGR) | % |
| Loan Growth (3Y CAGR) | % |
| Deposit Growth (3Y CAGR) | % |

Also includes YoY trendlines for the past 3 years to show growth momentum. Peer group arithmetic mean used (not weighted) to avoid skew from incomplete historical data.

---

## 5. Dynamic Peer Group Benchmarking

- Peer group is determined automatically from the selected bank's **total assets** (size tier) and **state** (geographic proximity)
- Asset tiers: Community ($300M–$1B), Mid-size ($1B–$10B), Regional ($10B–$100B), Large ($100B+)
- Geographic proximity scoring prioritizes same-state peers, then neighboring states
- Benchmarks recalculate automatically when a new bank is selected
- Peer group label displays next to the dashboard header (e.g., "Benchmark: Regional Bank Peer Group")
- Sample size is clickable → opens Peer Group Modal

---

## 6. Peer Group Modal

- Lists all banks in the current peer group
- Shows name, state, and asset size for each peer
- Visual indicator of geographic proximity to the selected bank

---

## 7. AI Summary ("AI Summarize" button)

- Triggers a Gemini API call with the selected bank's KPIs and benchmarks as context.
- **Requires Authentication**: User must be logged in.
- Generates a structured financial performance narrative.
- Includes contextual introduction about the bank (uses Gemini's external knowledge for background).
- Output covers: strengths, weaknesses, and forward-looking signals.
- Displayed in a modal overlay.

---

## 8. Operational Efficiency Dashboard

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

## 9. Market Movers / Competitive Brief

A competitive intelligence layer built on top of the benchmark data.

### Entry Point
- **"📊 Competitive Brief →" button** appears on the bank dashboard after financials + benchmarks load.
- Opens as a **dark mode view** directly in the main app or sidecar.

### What it does
- Fetches the same peer group as the main dashboard.
- Computes **QoQ deltas** (Q3 2025 → Q4 2025) for all 12 KPIs across all peers.
- Ranks peers by **"surprise score"** (sum of absolute robust z-scores) — most surprising movers ranked first.
- Displays top 5 movers with their top 3 driver KPIs and direction (positive/negative).
- **Drill-down support**: Clicking a mover bank's name in the brief instantly switches the main dashboard to that bank's detailed benchmarks.
- Handles peers with missing data gracefully: skips them, shows a warning, requires ≥5 complete peers.

### Intelligence Tape
Raw structured data output, formatted for human readability and Gemini input:
```
Market Movers — Peer Group — Q4 2025 vs Q3 2025
Peers: N=19

1. AMERICAN EXPRESS NB | dir=positive | surprise=21.13
   - NIM: Δ +206 bp | z=+12.80 | improving | better_than_median
   ...
```

### Perspective Bank Snapshot
- When the focus bank's data is available, a **"📎 Posture:" field** appears pre-filled with an auto-inferred strategic posture (e.g., "arrest funding cost escalation; defend NIM leadership").
- User can edit or clear the posture before sending to Gemini.
- The snapshot (6 KPIs with peer medians and quartile labels) is appended to the Gemini prompt to personalize the competitive advice.

### Gemini Analysis
- "Analyze with Gemini" button sends the tape + snapshot to Gemini 2.5 Flash.
- **Requires Authentication**: Subject to the 2x/day daily quota.
- Output format per competitor bank:
  - **Theme** + classification (Threat / Opportunity / Monitor)
  - **Confidence** label: High / Medium / Low (deterministic, based on z-scores and signal coherence)
  - **What changed (QoQ)**: analytical observations in plain English (ordinal peer language)
  - **So what**: competitive posture interpretation
  - **What [focus bank] should do**: Defend / Attack / Monitor actions (client-facing only)
  - **Watch next quarter**: conditional IF/THEN signals

------

## Technical Notes

| Item | Detail |
|---|---|
| Data freshness | FDIC Q4 2025 data available; Q1 2026 not yet published |
| Quarters analyzed | Q3 2025 (prior) vs Q4 2025 (current) — hardcoded for now |
| Peer count | Typically N=18–22 after filtering for complete data |
| KPI computation | `calculateKPIs()` in `kpiCalculator.js` — all from FDIC public fields |
| Gemini model | `gemini-2.5-flash` via REST API |
| Quota Management | Vercel KV (Redis) storing daily counts per LinkedIn Sub |
| Security | LinkedIn OAuth2 authorization code flow with server-side secret |

---

## What's NOT in the app (yet)

- No Threats vs Playbooks tab split (deferred)
- Operational dashboard uses static industry benchmarks (not FDIC live data)
- No quarter selector (Q3→Q4 2025 is hardcoded)
