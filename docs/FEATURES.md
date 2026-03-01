# Application Features & Modules

The Bank Value Benchmark contains several deeply interwoven modules tailored for financial analysts and bank executives. Here is a breakdown of the primary business logic and features.

## 1. Financial Health Dashboard
The default entry view after selecting a bank. Assesses the target institution across 9 standard banking KPIs.

- **Formula Engine (`kpiCalculator.js`)**: Converts raw FDIC Call Report identifiers (e.g., `NIMY`, `ASSET`, `ROA`) into comprehensive time-series formats.
- **Gauge Visualizations**: Each KPI is mapped to a semi-circle gauge chart colored based on the bank's percentile rank among its 20 computed peers. Green = top quartile, Yellow = median, Red = bottom quartile. Color logic auto-inverts for "lower is better" metrics.
- **Quartile Tooltips**: Each gauge shows a contextual tooltip (e.g., "Top Quartile", "Below Median") with correct inversion for inverse metrics.
- **Sparklines**: A 16-quarter historical trend view showing the KPI against the prevailing peer median.
- **Loading Skeleton**: `FinancialDashboardSkeleton.jsx` renders animated placeholder cards while data loads.

## 2. 3-Year Growth Performance (CAGR)
Three separate gauges shown below the main scorecard:
- Asset Growth (3Y CAGR)
- Loan Growth (3Y CAGR)
- Deposit Growth (3Y CAGR)

Peer group arithmetic mean used (not weighted) to prevent skew from incomplete historical peer data.

## 3. AI Executive Summary (`SummaryModal.jsx`)
An LLM-driven module that synthesizes raw financial data into a readable strategic brief.

- **Trigger**: "AI Summarize" button.
- **Auth Gate**: Requires a valid LinkedIn session (2 calls/day quota).
- **Rate Limit Handling**: Auto-retries on Gemini 429 rate limits with animated countdown.
- **Actions after generation:**
  - **Copy Report**: Copies raw markdown to clipboard.
  - **Export HTML Brief**: Downloads a styled standalone `.html` executive brief.
  - **Save Brief**: Persists the brief to Redis via `POST /api/briefs`.
  - **Regenerate**: Re-triggers the Gemini call.

## 4. Market Movers / Competitive Radar (`MoversSummaryModal.jsx`)
A feature that dynamically tracks positive and negative outliers across the peer segment.

- **Calculation**: Computes Quarter-over-Quarter (QoQ) deltas for every KPI across the 20-bank peer sample.
- **Z-Score Normalization**: Uses Robust Z-Scores to identify statistically significant movers.
- **Drill-Down**: Clicking a peer bank in the modal refocuses the main dashboard on that bank.
- **Save Brief**: Competitive intel output can be saved via `POST /api/briefs` (type: `competitive_brief`).

## 5. Operational "Give-to-Get" Dashboard
A module allowing users to input their own operational metrics (not publicly tracked by FDIC) to unlock industry benchmarks.

- Compares inputs against static seed data distributions.
- Metrics: Digital Adoption Rate, Digital Account Opening, Vendor Spend, Average Customer Age, NPS.
- Gauges are locked/blurred until the user submits their data.

## 6. Strategic Planner / Scenario Analysis (`StrategicPlannerTab.jsx`)
A forward-looking simulation tool. Executives can model specific strategic actions (e.g., "Grow core deposits by 5%").

- Uses basic linear ML models to map operational improvements to core KPIs (ROE, NIM, etc.).
- Visualizes "Current State" vs. "Simulated State" side-by-side using the gauge paradigm.
- Also embedded (scaled) in the Pitchbook Presentation – Slide 5.

## 7. Geographic Overlap & M&A Radar (`USMap.jsx`)
Maps the branch footprint of a target bank.

- Fetches individual branch addresses via the FDIC Locations API.
- Plots concentrations on an interactive SVG tile map of the US.
- Accessible via the Peer Group Modal.

## 8. Pitchbook Presentation Mode (`PitchbookPresentation.jsx`)
A full-screen IB-style 16:9 slide deck rendered in React.

- **5 Slides:**
  1. Cover — Bank name, location, date.
  2. Strategic Summary — AI bullets extracted from cached Gemini output, each paired with an inline sparkline matched by keyword heuristics.
  3. Core Financial Performance — 6 gauge charts vs. peer group.
  4. Market Positioning — Embedded `MoversView` in presentation mode (no drill-down).
  5. Forward-Looking Strategy — Embedded `StrategicPlannerTab` scaled to 90%.
- **Navigation**: `→` / `Space` to advance, `←` to go back, `Escape` to exit.
- IB branding: "STRICTLY CONFIDENTIAL" footer, bank name footer, blue branding stripe.

## 9. PDF Export (`src/components/pdf/`)
A print-to-PDF pipeline using `react-to-print`.

- **PrintContainer**: Hidden off-screen component hosting 4 print slides, passed by ref to `react-to-print`.
- **Slide 1** — Core financial KPI gauges.
- **Slide 2** — Returns and yield metrics.
- **Slide 3** — AI-generated executive summary narrative.
- **Slide 4** — Peer group list and asset tier information.
- Each slide: fixed 16:9 layout, blue branding strip, confidentiality footer.

## 10. Saved Briefs (`SavedBriefsModal.jsx` + `api/briefs.js`)
Persistent brief management per user, backed by Redis.

- **Save**: Available after AI generation in both `SummaryModal` and `MoversSummaryModal`.
- **View**: "My Saved Briefs" button in `UserProfileMenu` opens `SavedBriefsModal`.
- **Delete**: Each brief can be individually deleted.
- **Storage**: Redis hash `briefs:<linkedin_sub>` with each brief stored as a field.

## 11. HTML Brief Export (`src/utils/exportHtmlBrief.js`)
Generates a fully self-contained styled `.html` executive brief file.

- Triggered by "Export HTML Brief" button in `SummaryModal`.
- File named `[bank]_Executive_Brief_[date].html`, auto-downloaded by the browser.
- No server required — pure client-side blob generation.

## 12. User Profile Menu (`UserProfileMenu.jsx`)
Persistent UI element in the top-right corner of the app header when logged in.

- Shows user's LinkedIn name/avatar.
- "My Saved Briefs" button opens `SavedBriefsModal`.
- Logout button clears session and resets `AuthContext`.
