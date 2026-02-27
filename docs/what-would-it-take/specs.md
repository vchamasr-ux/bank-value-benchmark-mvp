# Strategic Planner ("What Would It Take?") Specifications

## 1. The Model Artifact Contract (`model.json`)
The frontend and the offline training pipeline are decoupled. They communicate exclusively via a static JSON artifact.

### Location
`public/models/whatwouldittake_v1.json`

### Schema Structure (V3 Tiered)
```json
{
  "schema_version": "3.0",
  "trained_on": {
    "asof": "2026-02-27",
    "quarters": ["2018Q1", "2025Q4"]
  },
  "tiers": {
    "<$1B": {
      "n_banks": 3000,
      "n_rows": 60000,
      "features": ["efficiencyRatio", "nonInterestIncomePercent", "yieldOnLoans", "costOfFunds"],
      "scaler": { ... },
      "targets": { ... },
      "lever_bounds": { ... },
      "tradeoffs": { ... },
      "confidence_metrics": { ... }
    },
    "$1B-$10B": { ... },
    "$10B-$50B": { ... },
    "$50B-$100B": { ... },
    "$100B-$250B": { ... },
    ">$250B": { ... }
  }
}
```

## 2. Frontend Component (`StrategicPlannerTab.jsx`)

### Inputs (Props)
*   `financials`: Object containing the current bank's KPIs.
*   `benchmarks`: Object containing the peer group statistics (median, p25, p75).
*   `assetTier`: The selected bank's asset tier string (e.g. "<$1B").

### State Management
*   `activeTarget`: The user-selected goal (e.g., 'returnOnAssets').
*   `targetType`: The user-selected benchmark relative to the peer group.
*   `modelArtifact`: The loaded JSON schema.
*   `error`: Any fatal error that prevents rendering.

### The Inverse Solver Logic (V3)
Given a desired change in target $\Delta Y$:
1. Determine the set of active features (levers) based on the target mapping.
2. Generate base Single-Lever Paths by calculating required change $\Delta X_i = \Delta Y / \beta_i$.
3. **Do No Harm Check**: If moving $X_i$ to close the gap requires moving it in its "worse" direction, discard the path.
4. **Hard Caps**: Clamp $\Delta X_i$ against hardcoded realistic limits (e.g. 5% max efficiency bump).
5. Generate **Multivariate Combination Paths**:
   - Path C (Balanced): Spread $\Delta Y$ evenly across all active levers, clamped.
   - Path D (Aggressive): Push 2 primary levers to 80% of max bounds.

### Error Handling Rules
*   **Missing Artifact:** If fetch returns 404, throw error.
*   **Invalid Schema:** If `schema_version` implies wrong format, throw error.
*   **Missing Features:** If the `financials` object lacks any key listed in `modelArtifact.tiers[assetTier].features`, throw error.

## 3. Scope for Version 3 (In Progress)
*   **Asset-Tiered Models:** Separate regressions for 6 different bank sizes.
*   **"Do No Harm":** Solver rejects mathematically sound but practically stupid paths.
*   **Hard Limits:** 12-month operational ceilings enforced.
*   **Multivariate Scenarios:** Expanding beyond 2 simple paths to 4-5 combination paths.
