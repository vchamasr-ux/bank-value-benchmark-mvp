# Strategic Planner ("What Would It Take?") Specifications

## 1. The Model Artifact Contract (`model.json`)
The frontend and the offline training pipeline are decoupled. They communicate exclusively via a static JSON artifact.

### Location
`public/models/whatwouldittake_v1.json`

### Schema Structure
```json
{
  "schema_version": "1.0",
  "trained_on": {
    "asof": "2026-02-27",
    "quarters": ["2018Q1", "2025Q4"],
    "n_banks": 4200,
    "n_rows": 80000
  },
  "features": [
    "efficiencyRatio",
    "nonInterestIncomePercent",
    "yieldOnLoans",
    "assetsPerEmployee"
  ],
  "scaler": {
    "mean": [0.65, 0.20, 0.05, 8000000],
    "std":  [0.15, 0.10, 0.02, 3000000]
  },
  "targets": {
    "roa": { 
      "coef": [-0.015, 0.005, 0.025, 0.0000001], 
      "intercept": 0.011, 
      "rmse": 0.0021 
    },
    "costOfFunds": { 
      "coef": [0.001, -0.002, 0.5, -0.00000005], 
      "intercept": 0.025, 
      "rmse": 0.0017 
    }
  },
  "lever_bounds": {
    "4q": { 
      "efficiencyRatio": {"min": -0.05, "max": 0.05}
    }
  }
}
```

## 2. Frontend Component (`StrategicPlannerTab.jsx`)

### Inputs (Props)
*   `financials`: Object containing the current bank's KPIs.
*   `benchmarks`: Object containing the peer group statistics (median, p25, p75).

### State Management
*   `activeTarget`: The user-selected goal (e.g., 'roa').
*   `targetType`: The user-selected benchmark relative to the peer group (e.g., 'median', 'p75', 'absolute').
*   `horizon`: Timeframe for the goal (fixed at '4q' for V1).
*   `modelArtifact`: The loaded JSON schema.
*   `error`: Any fatal error that prevents rendering.

### The Inverse Solver Logic (V1)
Given a desired change in target $\Delta Y$:
1. Determine the set of active features (levers).
2. For a simple single-lever path, the required change in feature $X_i$ is $\Delta X_i = \Delta Y / \beta_i$.
3. Clamp $\Delta X_i$ against `lever_bounds.4q[Xi]`.
4. If the clamped value is insufficient to reach the target, report the maximum achievable $\Delta Y$ and flag the scenario as constrained.

### Error Handling Rules
*   **Missing Artifact:** If fetch returns 404, throw error "Model artifact missing. Run offline training pipeline."
*   **Invalid Schema:** If `schema_version` is missing, throw error "Invalid model architecture."
*   **Missing Features:** If the `financials` object passed to the component lacks any key listed in `modelArtifact.features`, throw error `Missing required KPI in runtime data: ${missingKey}`.

## 3. Scope for Version 1
*   **Targets:** ROA (Return on Assets), Cost of Funds.
*   **Levers:** Efficiency Ratio, Yield on Loans, Non-Interest Income %. (Keep list small to ensure stability).
*   **Horizon:** 4 Quarters only.
