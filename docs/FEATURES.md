# Application Features & Modules

The Bank Value Benchmark contains several deeply interwoven modules tailored for financial analysts and bank executives. Here is a breakdown of the primary business logic and features.

## 1. Financial Health Dashboard
The default entry view after selecting a bank. Assesses the target institution across standard banking KPIs.

- **Formula Engine (`kpiCalculator.js`)**: Converts raw FDIC Call Report identifiers (e.g., `NIMY`, `ASSET`, `ROA`) into comprehensive time-series formats.
- **Gauge Visualizations**: Each KPI is mapped to a gauge chart colored based on the bank's percentile rank among its 20 computed peers. Green indicates top quartile (P75+ or P25- depending on if the metric is "higher is better" or "lower is better"), Yellow is median, Red is bottom quartile.
- **Sparklines**: A 16-quarter historical view showing the trend of the KPI against the prevailing median of the peer group.

## 2. AI Executive Summary (`SummaryModal.jsx`)
An LLM-driven module designed to synthesize vast amounts of raw financial data into a human-readable strategic brief.

- **Trigger**: "AI Summarize" button.
- **Auth Gate**: Requires a valid LinkedIn session.
- **Prompt Engineering**: The frontend bundles the target bank's latest KPIs alongside the statistical peer benchmarks and structured context regarding the banking segment. This is sent to `/api/insights` which proxies it to `gemini-2.5-flash`.
- **Output Validation**: Ensures AI uses appropriate financial terminology (e.g., recognizing raw FDIC values are in $000s).

## 3. Market Movers / Competitive Radar
A feature that dynamically tracks positive and negative outliers across the peer segment.

- **Calculation**: Computes Quarter-over-Quarter (QoQ) deltas for every KPI across the entire 20-bank peer sample.
- **Z-Score Normalization**: Determines which banks had statistically significant improvements (or degradations) in the most recent quarter using Robust Z-Scores to ignore noise.
- **Drill-Down**: Interactive modal allows the user to click a peer bank and immediately set that bank as the new analytical target of the entire application.

## 4. Operational "Give-to-Get" Dashboard
A module allowing users to input their own operational metrics (which are not publicly tracked by the FDIC, such as "Cost per Account") to unlock industry baselines.

- Compares inputs against static seed data distributions (averages and top quartiles).
- Provides instant gap analysis.

## 5. Strategic Planner (Scenario Analysis)
A forward-looking tool allowing executives to simulate the impact of specific strategic actions (e.g., "Grow core deposits by 5%", or "Reduce non-interest expense").

- Uses basic Machine Learning / linear models to map operational improvements to core financial KPIs (like ROE or NIM).
- Visualizes the "Current State" vs "Simulated State" side-by-side using the gauge paradigm.

## 6. Geographic Overlap & M&A Radar
(Phase 5 Module) Maps the branch footprint of a target bank against an acquirer.

- Fetches individual branch addresses via the FDIC Locations API.
- Plots concentrations on an interactive SVG map of the US to visually identify market synergies or potential antitrust overlaps (e.g., excessive combined deposit share in a single MSA).
