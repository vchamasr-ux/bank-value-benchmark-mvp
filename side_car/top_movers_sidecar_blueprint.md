> **Status:** ✅ Fully implemented as of February 2026. This document is the original design blueprint. For the completed implementation details and checklist, see [`top_movers_sidecar_implementation_checklist.md`](./top_movers_sidecar_implementation_checklist.md).

# Top Movers Sidecar Blueprint (Option 2: Market Movers)


**Purpose:** Add a *safe*, *additive* “Market Movers” sidecar to your existing FDIC benchmarking app that:
- scans a peer segment (e.g., **Assets > $250B**),
- finds the **top movers** (positive + negative) based on **QoQ changes** across KPIs,
- generates a concise **movers tape** (delta / delta_pct / z / improving vs deteriorating),
- sends that tape to Gemini to produce a **competitive briefing**: *“so what / what should JPM do in response / what to watch next quarter”*.

This is designed to **not break** your currently working benchmark dashboards and to remain **no-backend at runtime**.

---

## 1) Why this feature is a meaningful product shift

Your current app answers: **“How does Bank X compare to peers on levels (avg / quartiles)?”**

Market Movers adds a new workflow: **“What’s changing in my segment, and what should we do about it?”**
- **Threats (negative movers):** likely competitive pressure or stress → “watch + respond”
- **Playbooks (positive movers):** someone found something that worked → “benchmark + replicate”

This is **competitive-intelligence + response planning**, not just nicer narrative.

---

## 2) Non-goals (to keep this safe)

- No changes to existing working benchmark flow/components.
- No new backend services required at runtime.
- No attempt to “predict failures” or label institutions as distressed.
- No real-time monitoring (FDIC financials are quarterly); this is a *quarterly briefing companion*.

---

## 3) High-level UX

### Entry
- Hidden route / feature-flagged link: **Market Movers**
- Select:
  - **Segment** (e.g., Assets > $250B)
  - **Quarters:** `priorQuarter → currentQuarter` (QoQ)
  - **Perspective bank** (optional) (e.g., “JPMorgan Chase”) to frame actions

### Output (sidecar)
- **Concise Movers Tape** (for Gemini)
- Buttons:
  - **Copy tape**
  - **Send to Gemini**
- Gemini returns a briefing:
  - Top movers: theme, what changed (3 bullets), so what (2–3 sentences)
  - **What JPM should do in response** (3 bullets)
  - Watch next quarter (1 bullet)
  - Optional: confidence + show math (accordion)

---

## 4) Data requirements

### 4.1 Inputs you already have (confirmed)
- Peer list (cert/name/assets) for a segment
- Each peer bank’s **individual KPI values** (since you compute avg/quartiles)
- You can fetch **previous quarter** values too

### 4.2 Minimal dataset per bank-quarter
For each bank in the segment and each of two quarters:
- `cert` (or other stable bank ID)
- `bank_name`
- `assetsUsd` (for segment filter)
- KPI values for a consistent KPI set

### 4.3 KPI set (initial)
Match your existing dashboards:
- Efficiency Ratio (lower better)
- Net Interest Margin (higher better)
- Cost of Funds (lower better)
- Non-Interest Income % (higher better)
- Yield on Loans (higher better)
- Assets per Employee (higher better; scalar)
- ROE (higher better)
- ROA (higher better)
- NPL ratio (lower better)

> **Hard rule:** Rates must be **decimals** (e.g., 1.32% → `0.0132`). Fail loudly otherwise.

---

## 5) Scoring model (deterministic, audit-friendly)

### 5.1 Compute deltas
For each bank `b` and KPI `k`:
- `delta[b,k] = KPI[b,current] - KPI[b,prior]`

### 5.2 Peer delta distributions
For each KPI `k`, across peers:
- collect `delta[:,k]`
- compute robust stats:
  - `p50 = median(delta[:,k])`
  - `p25, p75`
  - `IQR = p75 - p25` (must be nonzero)

### 5.3 Robust z-score (extremeness)
For each bank and KPI:
- `z[b,k] = (delta[b,k] - p50[k]) / IQR[k]`

### 5.4 delta percentile (rank among peers)
- `delta_pct[b,k] = percentile_rank(delta[:,k], delta[b,k])` in `[0..1]`

### 5.5 Improving vs deteriorating (directionality)
Depends on whether higher or lower is better:
- If **higher is better**:
  - `delta > 0` → improving
  - `delta < 0` → deteriorating
- If **lower is better**:
  - `delta < 0` → improving
  - `delta > 0` → deteriorating

### 5.6 Surprise score (bank mover ranking)
A simple, strong baseline:
- `surprise[b] = sum_k |z[b,k]|` (optionally weighted later)
- `signed_score[b] = sum_k signed_z[b,k]`
  - `signed_z = z` if higher is better; `signed_z = -z` if lower is better
- `dir[b] = positive if signed_score >= 0 else negative`

### 5.7 Top drivers
For each mover, show the **top 3 KPIs** by `|z|`.

---

## 6) The concise “Movers Tape” format (what you send to Gemini)

### 6.1 Tape header
- Segment label + quarters + peer count

### 6.2 Each mover block
- rank, bank name, `dir`, `surprise`
- 3 driver lines:
  - KPI label
  - delta (bp for rates; “M” for large scalars)
  - `delta_pct`
  - `z`
  - improving/deteriorating

Example:

```
Market Movers — Assets > $250B — 2025Q4 vs 2025Q3
Peers: N=16

1. Wells Fargo Bank, N.A. | dir=negative | surprise=13.24
   - Cost of Funds: Δ +69 bp | delta_pct=1.00 | z=+3.78 | deteriorating
   - Net Interest Margin (NIM): Δ +44 bp | delta_pct=1.00 | z=+2.85 | improving
   - Non-Interest Income %: Δ -196 bp | delta_pct=0.07 | z=-2.81 | deteriorating
```

### 6.3 Optional: include focus bank (e.g., JPM) rank
Add a section:
- “Focus bank: JPMorgan Chase (rank X)” and show its top 3 driver lines

---

## 7) Gemini prompt (competitive briefing, JPM perspective)

### 7.1 Key constraints (must include)
- Use **only** tape content; do not add numbers.
- Define `delta_pct` as percentile rank (not a % change).
- `z` is robust z (median/IQR).
- improving/deteriorating already accounts for directionality.

### 7.2 Output structure (narrative, not JSON)
For each top mover:
- Theme label (funding shock, margin compression, fee mix swing, efficiency swing, credit move, productivity move)
- What changed (max 3 bullets)
- So what (2–3 sentences)
- **What JPM should do in response** (3 bullets; competitive response, not “fix the mover internally”)
- Watch next quarter (1 bullet)

---

## 8) “No backend” runtime architecture

### 8.1 Runtime behavior (client-only)
1) Fetch peer list for current quarter segment
2) Fetch KPIs for each peer for `priorQuarter` and `currentQuarter`
3) Compute movers + build tape in-browser
4) Send tape to Gemini (same way you do AI Summarize today)
5) Render Gemini narrative

### 8.2 Performance + reliability guardrails
- Concurrency limit peer KPI fetches (e.g., 4 at a time) if needed
- Cache responses in memory (and optionally localStorage) per `cert+quarter`
- Fail loud on missing KPIs or bad rate formats (no silent fallbacks)

---

## 9) Safe rollout plan (protect the working app)

### 9.1 Feature flag
- Add env flag (e.g., `FEATURE_MOVERS=false` in production)
- Only show the Market Movers route/link when true
- Even if merged, it’s inert in prod until you flip the flag

### 9.2 Isolation
- Implement in new component(s) only:
  - `src/components/MarketMoversConcise.jsx`
- Avoid changes to existing:
  - `FinancialDashboard.jsx`
  - `OperationalDashboard.jsx`
  - gauge components, peer selection flows
- Reuse existing services via a **dataProvider adapter**, not by rewriting services

### 9.3 Deployment
- Work on a branch; use Vercel preview deploys
- Promote to prod only after:
  - existing benchmark flows unchanged
  - no console/runtime errors
  - Movers page loads and produces tape for at least one segment

---

## 10) Code organization (aligned to your repo)

Suggested add-only files:

- `src/components/MarketMoversConcise.jsx`  
  Sidecar UI: compute tape + copy + send to Gemini

- `src/utils/movers.js` (optional)  
  If you want to separate math from UI; not required for MVP

- `src/services/dataProvider.js` (adapter)  
  Wrap existing functions:
  - `listPeerBanks({ segmentKey, quarter })`
  - `getBankKpis({ cert, quarter })`
  - `generateGeminiText({ prompt })`

> **Note:** The adapter is the “single place” you map your existing code to the sidecar without touching working flows.

---

## 11) Acceptance criteria (MVP)

### Functional
- Sidecar loads peer set for a segment and two quarters
- Produces a tape with:
  - top 3 movers (by surprise)
  - each with top 3 driver lines
- Copy-to-clipboard works
- “Send to Gemini” returns a narrative competitive briefing

### Safety
- Existing benchmark pages unchanged and still work
- Feature flag off in prod by default
- Fail loud on missing KPI keys or rate format errors

### Output quality
- Gemini briefing clearly answers:
  - what changed
  - so what
  - what JPM should do in response
  - what to watch next quarter

---

## 12) Testing checklist (fast, practical)

- **Smoke test:** existing benchmark page loads and renders for JPM
- **Sidecar test:**
  - segment with known peer list loads
  - tape generation completes without errors
  - top movers list changes when you change quarters/segment
- **Edge cases:**
  - IQR=0 for a KPI (should error loudly and identify the KPI)
  - Missing KPI for one peer bank (error with bank name/cert)
  - Rate metric passed as 1.32 instead of 0.0132 (error loudly)

---

## 13) How this relates to Option 3

Everything above is Option 2 (Market Movers) + “so what / what can JPM do” narrative.

**Option 3** becomes a natural extension *inside the same sidecar*:
- From a mover card: “Respond as JPM” → deeper playbook suggestions
- Two future directions:
  1) **Playbook mining (no training):** find historical analog quarters with similar driver stacks; show what typically improved next 1–4 quarters
  2) **Expected vs actual (trained model):** ship a small static model artifact for “residual” analysis and “what would it take” scenarios

But **you don’t need Option 3 to launch**: Option 2 + Gemini competitive briefing is already a strong wedge.

---

## 14) Next implementation step (lowest risk)
1) Add **MarketMoversConcise.jsx** behind feature flag
2) Implement `dataProvider` adapter by reusing your existing peer list + KPI fetch
3) Generate tape + copy button
4) Wire “Send to Gemini” using the same mechanism as AI Summarize
