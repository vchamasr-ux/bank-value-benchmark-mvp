# "What Would It Take?" (Strategic Planner) Blueprint

## Vision
To elevate BankValue from a descriptive benchmarking tool to a prescriptive strategic planning engine. By answering "What Would It Take?", the platform allows bank executives to set a target for a KPI (e.g., matching the peer median for ROA) and immediately see the specific operational lever movements required to achieve that goal within a specific timeframe.

## Core Philosophy
1.  **Decoupled Architecture:** The heavy lifting (data assembly, cleaning, and model training) occurs entirely offline in a "staging" environment. The BankValue frontend remains lightweight, stateless, and fast.
2.  **Stateless Inference:** The frontend acts as an inference engine. It loads a static, versioned JSON artifact (`model.json`) representing the trained model and performs simple matrix multiplication (forward prediction) and constrained optimization (inverse solving) directly in the browser.
3.  **Fail Loudly (Zero Tolerance):** In accordance with the application's core principles, if the `model.json` artifact is missing, malformed, or out-of-date relative to the current feature set, the UI must explicitly block execution and display a hard error. Silent fallbacks or "best guess" estimates are strictly forbidden.
4.  **Directional Sanity over False Precision:** The engine is not meant to replace an ALM model. It is designed to provide *credible, directionally accurate* strategic scenarios. Guardrails (lever bounds) ensure the model never suggests impossible or unprecedented operational shifts.

## High-Level Architecture

### Part A: Offline Staging & Training (The "Heavy Build")
*This part is executed entirely outside the runtime application.*
1.  **Data Ingestion:** A script pulls comprehensive historical bank performance data from the FDIC API.
2.  **Panel Construction:** Data is assembled into a longitudinal panel (bank-quarter rows) spanning at least 5 years.
3.  **Modeling:** Regularized regression models (e.g., Ridge) are trained for specific target KPIs (e.g., ROA, Cost of Funds) against a defined set of "lever" features (e.g., Efficiency Ratio, Non-Interest Income %, Yield on Loans).
4.  **Artifact Generation:** The script outputs a single, standalone artifact: `whatwouldittake_v1.json`. This file contains the schema version, training metadata, feature list, scaling parameters, model coefficients, and historical bounds for lever movements.

### Part B: Frontend Inference Engine (The "Interactive Tab")
*This part runs entirely in the user's browser within the BankValue app.*
1.  **Artifact Ingestion:** The `StrategicPlannerTab` component fetches `public/models/whatwouldittake_v1.json`.
2.  **Context Loading:** The tab receives the currently selected bank's KPIs and the peer group benchmarks as React props (reusing existing app plumbing).
3.  **Scenario Definition:** The user selects a Target KPI, a Target Value (e.g., Peer Median), and a Horizon (e.g., 4 Quarters).
4.  **Gap Analysis:** The UI calculates the absolute difference between the current state and the target state.
5.  **Inverse Solving:** The application uses the model coefficients to calculate required movements in selected levers to close the gap.
6.  **Guardrail Enforcement:** The engine clamps suggested lever movements against the bounds defined in the model artifact.
7.  **Tradeoff Projection:** The UI projects the secondary impact of the suggested lever movements on other modeled KPIs.

## Future Enhancements
*   Expanding the target KPI list to include Net Interest Margin, NPL Ratio, etc.
*   incorporating more complex growth-related levers (e.g., Loan Growth, Deposit Growth).
*   Adding "Confidence Scores" derived from model RMSE and historical anomaly detection.
