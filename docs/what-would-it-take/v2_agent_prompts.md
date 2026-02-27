# Strategic Planner V2: Multi-Agent Delegation Prompts

These prompts are designed to be copy-pasted to independent agents to execute Phase 5 and Phase 6 of the Strategic Planner V2 roadmap simultaneously.

---

## Agent 1: Python Data Scientist (Phase 5 - Offline Pipeline)
**Target File:** `scripts/offline_training/train_pipeline.py`

**Prompt for the Agent:**
```text
I need you to upgrade the `train_pipeline.py` script for our BankValue Strategic Planner to "V2". 

Here are your core tasks:
1.  **Read the Specs:** First, read `docs/what-would-it-take/specs.md` and `docs/what-would-it-take/todos.md` to understand the V2 architecture and the new JSON schema requirements.
2.  **Tradeoff Matrix:** Modify the `train_and_export` function to calculate the covariance/correlation matrix of our four core features (`efficiencyRatio`, `nonInterestIncomePercent`, `yieldOnLoans`, `costOfFunds`). We need to know how these levers typically move together historically. Export this as a new `"tradeoffs"` dictionary in the JSON artifact.
3.  **Expanded KPIs:** Add `netInterestMargin` (NIM) and `nptlRatio` (Non-Performing Loans to Total Loans) as both calculated KPIs in `calculate_kpis()` using the FDIC variables, and as new regression Targets.
4.  **Confidence Metrics:** Calculate a baseline distribution/density scalar for the features so the frontend can determine if a suggested lever move is a "High Confidence" (normal) or "Low Confidence" (anomaly) scenario. Export this in the JSON.
5.  **Output:** Update the output file name to `whatwouldittake_v2.json`. Ensure the pipeline runs without errors and produces valid JSON.
```

---

## Agent 2: React Frontend Engineer (Phase 6 - Interactive UI)
**Target File:** `src/components/StrategicPlannerTab.jsx`

**Prompt for the Agent:**
```text
I need you to upgrade the `StrategicPlannerTab.jsx` component to "V2". 

Here are your core tasks:
1.  **Read the Specs:** First, read `docs/what-would-it-take/specs.md` and `docs/what-would-it-take/blueprint.md` to understand the V2 architecture and the new JSON schema requirements (Tradeoffs and Confidence).
2.  **URL Update:** Change the fetch call to look for `whatwouldittake_v2.json` instead of `v1.json`.
3.  **Tradeoff Projections (Secondary Impact):** Modify the inverse solver logic. When the engine prescribes a move in Lever A, use the new `"tradeoffs"` matrix in the JSON to mathematically project the likely secondary impact on Lever B. Display this as a "Tradeoff Warning" beneath the path card.
4.  **Confidence Badges:** The JSON artifact now contains RMSE and density limits. Calculate a confidence score for each path (e.g., if a lever move is > 2 standard deviations, mark it Low Confidence). Add High/Med/Low visual badges to the Path cards.
5.  **Interactive Sliders:** This is the biggest UX change. Instead of just static "Path" cards showing a fixed prescription, refactor the UI to use interactive range sliders for the levers. When a user drags a lever slider manually, dynamically recalculate the remaining Gap to Target and update the other levers.
```
