# "What Would It Take?" Tasks & Checklist

## Phase 1: Planning & Scaffolding (Current)
- [x] Create documentation structure (`docs/what-would-it-take/`)
- [x] Write Blueprint (`blueprint.md`)
- [x] Write Technical Specs (`specs.md`)
- [x] Write Todos (`todos.md`)
- [ ] Create stub model artifact in `public/models/whatwouldittake_v1.json`
- [ ] Create scaffolding for `src/components/StrategicPlannerTab.jsx`
- [ ] Update `src/App.jsx` to render the new tab alongside "Banks" and "Market Movers"

## Phase 2: Frontend Implementation (V1)
- [x] Implement artifact loading and error boundary ("Fail Loudly" checks) in `StrategicPlannerTab`.
- [x] Build Target Selector UI (Target KPI, Peer Metric drop-downs).
- [x] Build the Gap Calculator (Current vs Target).
- [x] Implement the simplified Inverse Solver logic for 1-2 levers.
- [x] Build the "Paths" UI cards to display required lever movements.
- [x] Apply CSS/Tailwind styling consistent with `FinancialDashboard.jsx`.

## Phase 3: Offline Model Training Pipeline
- [x] Set up a Python/Jupyter environment.
- [x] Write script to connect to FDIC API and build historical panel data.
- [x] Clean and scale data.
- [x] Train Ridge Regression models for ROA and Cost of Funds.
- [x] Calculate empirical 4-quarter lever movement bounds.
- [x] Export trained parameters to `whatwouldittake_v1.json`.

## Phase 4: Integration & Validation
- [x] Replace stub artifact with real artifact.
- [x] Test inverse solver math against actual bank scenarios.
- [x] Validate edge cases (e.g., Target is already met; Target is mathematically impossible within bounds).
- [x] Final UI polish and review.

## Phase 5: V2 Offline Model Enhancements (Python Agent)
- [ ] Expand target KPIs to include Net Interest Margin (NIM) and Asset Quality (NPLs).
- [ ] Implement calculation and export of a feature covariance/correlation matrix for tradeoff projections.
- [ ] Calculate baseline confidence metrics/percentiles based on historical distribution density.
- [ ] Update `train_pipeline.py` to output `whatwouldittake_v2.json`.

## Phase 6: V2 Frontend Interactive Enhancements (React Agent)
- [ ] Parse new V2 artifact (`tradeoffs` matrix, `confidence` metrics).
- [ ] Implement secondary impact (Tradeoff) math in the inverse solver.
- [ ] Build UI to display tradeoff warnings beneath suggested paths.
- [ ] Build UI "Confidence Badges" (High/Medium/Low) based on RMSE and lever distance.
- [ ] Refactor static "Path Cards" into Interactive Sliders so users can manually tweak prescribed lever values.
