import React, { useEffect, useMemo, useState } from "react";

/**
 * MarketMoversConcise.jsx
 *
 * What it does:
 * - Loads peer list (your existing peer builder)
 * - Fetches each peer bank's KPIs for prior + current quarter
 * - Computes QoQ deltas + delta percentiles + robust z-scores (median/IQR)
 * - Ranks banks by "surprise" (sum of abs(z) across KPIs)
 * - Produces a concise text block (like your sample) to send to Gemini
 *
 * No backend required. No hardcoded "actions".
 *
 * REQUIRED dataProvider methods:
 *   - listPeerBanks({ segmentKey, quarter }) -> [{ cert, name, city, state, assetsUsd }]
 *   - getBankKpis({ cert, quarter }) -> { <kpiKey>: number, ... } (rates must be decimals)
 *   - generateGeminiText({ prompt }) -> string  (optional; wire to your existing Gemini call)
 *
 * Strictness:
 * - Fails loudly if any KPI is missing or rates look like % instead of decimals.
 */

// --- KPI config: align keys to your existing KPI extraction ---
const KPI_SPECS = [
    { key: "asset_growth_3y", label: "3Y Asset Growth (CAGR)", better: "higher", type: "rate" },
    { key: "loan_growth_3y", label: "3Y Loan Growth (CAGR)", better: "higher", type: "rate" },
    { key: "deposit_growth_3y", label: "3Y Deposit Growth (CAGR)", better: "higher", type: "rate" },
    { key: "eff_ratio", label: "Efficiency Ratio", better: "lower", type: "rate" },
    { key: "nim", label: "Net Interest Margin (NIM)", better: "higher", type: "rate" },
    { key: "cost_of_funds", label: "Cost of Funds", better: "lower", type: "rate" },
    { key: "non_int_income_pct", label: "Non-Interest Income %", better: "higher", type: "rate" },
    { key: "loan_yield", label: "Yield on Loans", better: "higher", type: "rate" },
    { key: "assets_per_employee", label: "Assets per Employee", better: "higher", type: "scalar" },
    { key: "roe", label: "Return on Equity (ROE)", better: "higher", type: "rate" },
    { key: "roa", label: "Return on Assets (ROA)", better: "higher", type: "rate" },
    { key: "npl_ratio", label: "NPL Ratio", better: "lower", type: "rate" },
];

// ----------------- tiny helpers -----------------
function assert(cond, msg) {
    if (!cond) throw new Error(`ERROR: ${msg}`);
}

function sorted(values) {
    const out = [...values];
    out.sort((a, b) => a - b);
    return out;
}

function quantile(sortedVals, q) {
    assert(sortedVals.length > 0, "quantile() on empty array");
    assert(q >= 0 && q <= 1, `quantile q must be in [0,1], got ${q}`);
    if (sortedVals.length === 1) return sortedVals[0];
    const pos = (sortedVals.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return sortedVals[lo];
    const w = pos - lo;
    return sortedVals[lo] * (1 - w) + sortedVals[hi] * w;
}

function percentileRank(sortedVals, x) {
    // count <= x using binary search
    let lo = 0;
    let hi = sortedVals.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (sortedVals[mid] <= x) lo = mid + 1;
        else hi = mid;
    }
    return sortedVals.length === 0 ? 0 : lo / sortedVals.length;
}

function validateKpis(kpis) {
    assert(kpis && typeof kpis === "object", "getBankKpis must return an object");
    for (const spec of KPI_SPECS) {
        assert(spec.key in kpis, `Missing KPI '${spec.key}'`);
        const v = kpis[spec.key];
        assert(typeof v === "number" && Number.isFinite(v), `KPI '${spec.key}' must be a finite number`);
        if (spec.type === "rate") {
            // Strict: rates must be decimals (e.g., 1.32% -> 0.0132)
            assert(
                Math.abs(v) <= 1.0,
                `KPI '${spec.key}' is a rate and must be decimal in [-1,1]. Example: 1.32% => 0.0132. Got ${v}`
            );
        }
    }
}

function fmtDelta(spec, delta) {
    if (!Number.isFinite(delta)) return "N/A";
    if (spec.type === "rate") {
        const bp = delta * 10000;
        const sign = bp >= 0 ? "+" : "";
        return `Δ ${sign}${bp.toFixed(0)} bp`;
    }
    // scalar: print in M if large enough, else raw
    const abs = Math.abs(delta);
    if (abs >= 1_000_000) {
        const m = delta / 1_000_000;
        const sign = m >= 0 ? "+" : "";
        return `Δ ${sign}${m.toFixed(2)}M`;
    }
    const sign = delta >= 0 ? "+" : "";
    return `Δ ${sign}${delta.toFixed(2)}`;
}

function fmtSigned(x, digits = 2) {
    assert(Number.isFinite(x), "fmtSigned expects finite number");
    const sign = x >= 0 ? "+" : "";
    return `${sign}${x.toFixed(digits)}`;
}

function effectLabel(spec, delta) {
    // improving/deteriorating relative to "better"
    if (spec.better === "higher") return delta > 0 ? "improving" : "deteriorating";
    return delta < 0 ? "improving" : "deteriorating";
}

function dirFromSignedScore(signedScore) {
    return signedScore >= 0 ? "positive" : "negative";
}

// --------------- core compute ---------------
function computeMovers({ peers, kpisByQuarterByCert, priorQuarter, currentQuarter, topN, focusCert }) {
    const certs = peers.map((p) => p.cert);

    // deltasByCert[cert][kpi] = cur - prev
    const deltasByCert = {};
    for (const cert of certs) {
        const prev = kpisByQuarterByCert[priorQuarter]?.[cert];
        const cur = kpisByQuarterByCert[currentQuarter]?.[cert];
        assert(prev && cur, `Missing KPI data for cert=${cert} for one of the quarters`);
        deltasByCert[cert] = {};
        for (const spec of KPI_SPECS) deltasByCert[cert][spec.key] = cur[spec.key] - prev[spec.key];
    }

    // distributions of deltas per metric + robust stats
    const distByMetric = {};
    const statsByMetric = {};

    for (const spec of KPI_SPECS) {
        const vals = certs.map((c) => deltasByCert[c][spec.key]);
        const sv = sorted(vals);
        const p25 = quantile(sv, 0.25);
        const p50 = quantile(sv, 0.50);
        const p75 = quantile(sv, 0.75);
        const iqr = p75 - p25;
        assert(iqr !== 0, `IQR=0 for metric '${spec.key}' delta distribution; cannot compute robust z`);
        distByMetric[spec.key] = sv;
        statsByMetric[spec.key] = { p50, iqr };
    }

    // compute per-bank scores + top drivers
    const rows = peers.map((bank) => {
        const cert = bank.cert;
        const drivers = KPI_SPECS.map((spec) => {
            const delta = deltasByCert[cert][spec.key];
            const { p50, iqr } = statsByMetric[spec.key];
            const z = (delta - p50) / iqr;
            const zCapped = Math.max(Math.min(z, 3), -3);
            const absZ = Math.abs(zCapped);

            const deltaPct = percentileRank(distByMetric[spec.key], delta);
            const eff = effectLabel(spec, delta);

            // signedZ so that + means "good movement"
            const signedZ = spec.better === "higher" ? z : -z;

            const vsPeersEffect = signedZ > 0 ? "better_than_median" : "worse_than_median";

            return {
                spec,
                delta,
                deltaPct,
                z,
                absZ,
                signedZ,
                vsPeersEffect,
                effect: eff,
            };
        }).sort((a, b) => b.absZ - a.absZ);

        const surprise = drivers.reduce((acc, d) => acc + d.absZ, 0);
        const signedScore = drivers.reduce((acc, d) => acc + d.signedZ, 0);
        const direction = dirFromSignedScore(signedScore);

        return {
            cert,
            bankName: bank.name,
            direction,
            surprise,
            driversTop3: drivers.slice(0, 3),
        };
    });

    // sort by surprise desc
    const ranked = [...rows].sort((a, b) => b.surprise - a.surprise);

    // ranks for printing (1-index)
    const rankByCert = new Map();
    ranked.forEach((r, idx) => rankByCert.set(r.cert, idx + 1));

    const top = ranked.slice(0, topN);

    let focusRow = null;
    if (focusCert) {
        focusRow = ranked.find((r) => r.cert === focusCert) || null;
    }

    return { top, ranked, rankByCert, focusRow };
}

function buildConciseTape({ segmentLabel, peerCount, priorQuarter, currentQuarter, moversTop, focusRow, focusRank }) {
    const lines = [];
    lines.push(`Market Movers — ${segmentLabel} — ${currentQuarter} vs ${priorQuarter}`);
    lines.push(`Peers: N=${peerCount}`);
    lines.push("");

    moversTop.forEach((m, idx) => {
        const rank = idx + 1;
        lines.push(` ${rank}. ${m.bankName} | dir=${m.direction} | surprise=${m.surprise.toFixed(2)}`);
        for (const d of m.driversTop3) {
            lines.push(
                `    - ${d.spec.label}: ${fmtDelta(d.spec, d.delta)} | delta_pct=${d.deltaPct.toFixed(2)} | z=${fmtSigned(d.z)} | ${d.effect} | vs_peers_effect=${d.vsPeersEffect}`
            );
        }
        lines.push("");
    });

    if (focusRow) {
        lines.push(`Focus bank: ${focusRow.bankName} (rank ${focusRank})`);
        lines.push(` ${focusRank}. ${focusRow.bankName} | dir=${focusRow.direction} | surprise=${focusRow.surprise.toFixed(2)}`);
        for (const d of focusRow.driversTop3) {
            lines.push(
                `    - ${d.spec.label}: ${fmtDelta(d.spec, d.delta)} | delta_pct=${d.deltaPct.toFixed(2)} | z=${fmtSigned(d.z)} | ${d.effect} | vs_peers_effect=${d.vsPeersEffect}`
            );
        }
        lines.push("");
    }

    return lines.join("\n");
}
// --------------- perspective bank snapshot ---------------
// SIZE LIMIT: capped at 6 KPI rows (~400-500 tokens). Do NOT expand — larger snapshots
// increase prompt size without meaningfully improving Gemini output, and risk 429 rate limits.
const SNAPSHOT_KPIS = [
    { key: "nim", label: "NIM", better: "higher", fmt: (v) => `${(v * 100).toFixed(2)}%` },
    { key: "cost_of_funds", label: "Cost of Funds", better: "lower", fmt: (v) => `${(v * 100).toFixed(2)}%` },
    { key: "eff_ratio", label: "Efficiency Ratio", better: "lower", fmt: (v) => `${(v * 100).toFixed(1)}%` },
    { key: "npl_ratio", label: "NPL Ratio", better: "lower", fmt: (v) => `${(v * 100).toFixed(2)}%` },
    { key: "roa", label: "ROA", better: "higher", fmt: (v) => `${(v * 100).toFixed(2)}%` },
    { key: "non_int_income_pct", label: "Non-Int Income %", better: "higher", fmt: (v) => `${(v * 100).toFixed(1)}%` },
    // MAX 6 rows — do not add more without removing one
];

/**
 * Builds compact KPI context for the focus bank.
 * @param {object} focusKpis - current-quarter KPI object for the focus bank
 * @param {object[]} allPeerKpisArray - array of current-quarter KPI objects for ALL peers (including focus)
 * @returns {{ rows: Array, quartileByKey: object }}
 */
function buildFocusBankSnapshot(focusKpis, allPeerKpisArray) {
    assert(focusKpis && typeof focusKpis === "object", "buildFocusBankSnapshot: focusKpis required");
    assert(Array.isArray(allPeerKpisArray) && allPeerKpisArray.length >= 4, "buildFocusBankSnapshot: need at least 4 peers");

    const rows = [];
    const quartileByKey = {};

    for (const snap of SNAPSHOT_KPIS) {
        const focusVal = focusKpis[snap.key];
        if (!Number.isFinite(focusVal)) continue; // skip if missing

        const peerVals = allPeerKpisArray
            .map((p) => p[snap.key])
            .filter(Number.isFinite);

        if (peerVals.length < 3) continue;

        const sv = sorted(peerVals);
        const median = quantile(sv, 0.5);
        const p25 = quantile(sv, 0.25);
        const p75 = quantile(sv, 0.75);

        // Quartile label from the bank's perspective (accounting for "better" direction)
        let quartileLabel;
        if (snap.better === "higher") {
            if (focusVal >= p75) quartileLabel = "top quartile";
            else if (focusVal <= p25) quartileLabel = "bottom quartile";
            else quartileLabel = "middle two quartiles";
        } else {
            // lower is better: top quartile = low value
            if (focusVal <= p25) quartileLabel = "top quartile";  // best (lowest)
            else if (focusVal >= p75) quartileLabel = "bottom quartile"; // worst (highest)
            else quartileLabel = "middle two quartiles";
        }

        quartileByKey[snap.key] = quartileLabel;
        rows.push({
            label: snap.label,
            value: snap.fmt(focusVal),
            median: snap.fmt(median),
            quartile: quartileLabel,
        });
    }

    return { rows, quartileByKey };
}

/**
 * Auto-infers a one-line strategic posture from the focus bank's quartile positions.
 * Deterministic — based on rules, not guessing.
 */
function inferObjective(quartileByKey) {
    const flags = [];

    if (quartileByKey.nim === "top quartile") flags.push("defend NIM leadership");
    if (quartileByKey.cost_of_funds === "bottom quartile") flags.push("arrest funding cost escalation");
    if (quartileByKey.eff_ratio === "bottom quartile") flags.push("improve cost discipline before scaling");
    if (quartileByKey.npl_ratio === "bottom quartile") flags.push("stabilize credit quality before expanding");
    if (quartileByKey.roa === "top quartile" && !flags.length) flags.push("press profitability advantage into share gains");

    if (!flags.length) return "balanced offense and defense";
    return flags.join("; ");
}


function buildGeminiPrompt({ tape, perspectiveBankName, focusBankSnapshot }) {
    // Build optional perspective bank addendum
    let snapshotBlock = "";
    if (focusBankSnapshot && focusBankSnapshot.rows.length > 0) {
        const lines = focusBankSnapshot.rows.map(
            (r) => `  - ${r.label}: ${r.value} (peer median: ${r.median}) → ${r.quartile}`
        );
        snapshotBlock = `
--- PERSPECTIVE BANK SNAPSHOT (${perspectiveBankName}) ---
This is the current strategic position of ${perspectiveBankName} relative to its own peers.
Use this to make "What ${perspectiveBankName} should do" bullets MORE SPECIFIC:
  - If ${perspectiveBankName} is top-quartile on a metric, lean into Attack actions in that area.
  - If ${perspectiveBankName} is bottom-quartile on a metric, weight Defend to protect that weakness.
  - Do NOT contradict the snapshot (e.g., don't suggest rate-war defense if cost of funds is already bottom-quartile).

${lines.join("\n")}
Inferred posture: ${focusBankSnapshot.objective}
`;
    }

    return `
You are a competitive-intelligence analyst writing for senior bankers at ${perspectiveBankName}. Use ONLY the data in the tape below. Do not invent numbers or add facts not present in the tape.

--- DEFINITIONS ---
- "Δ" = QoQ change (current quarter minus prior quarter).
- delta_pct = percentile rank of a bank's delta within the peer group (0..1). It is NOT a percent change.
- z = robust z-score: (bank delta − peer median delta) / peer IQR. How unusual the move is relative to peers. |z| > 2 is notable, |z| > 4 is extreme.
- "improving / deteriorating" already accounts for each metric's preferred direction (higher or lower is better).
- "vs_peers_effect" (better_than_median / worse_than_median) shows whether the bank moved in a more favorable direction than the median peer.

--- TWO TYPES OF FRAGILE METRICS (treat differently) ---
TYPE A — CAGR / Derived (3Y Asset / Loan / Deposit Growth):
  Multi-year rolling figures. A single quarter's CAGR shift may reflect a base-year change, not a genuine trend break.
  → Flag once as: "(CAGR-based; verify next quarter before concluding trend break)"

TYPE B — Denominator-Sensitive (Assets per Employee):
  Moves when headcount changes independently of assets. Dramatic swings may be a headcount event, not an operational shift.
  → Flag once as: "(headcount effect possible; verify next quarter)"

IMPORTANT: Do NOT apply TYPE A language to TYPE B metrics or vice versa.

--- CONFIDENCE LABEL (required, deterministic) ---
Assign each bank exactly one Confidence: High / Medium / Low based ONLY on the tape signals.
To determine Confidence, first identify the TOP DRIVER = the driver with the highest absolute |z| score.
  High   = 2 or more drivers with |z| >= 2 AND all pointing the same direction (all worse_than_median OR all better_than_median) AND the top driver is NOT a TYPE A or TYPE B fragile metric
  Medium = mixed driver directions, OR only 1 driver with |z| >= 2, OR signals partially offset each other
  Low    = the TOP DRIVER (highest |z|) is a TYPE A or TYPE B fragile metric — i.e., the thing that makes this bank "surprising" is fragile
Note: A fragile metric appearing as a secondary or tertiary driver does NOT automatically make Confidence Low.

--- OUTPUT FORMAT (one block per bank, exactly as shown) ---

[BANK NAME] — Theme: [theme label] ([Threat / Opportunity / Monitor]) | Confidence: [High / Medium / Low]
What changed (QoQ):
  • [One-sentence analytical observation in plain English. Use ordinal peer language: "worst in the peer set", "top 2 of 20", "bottom quartile of moves" — NOT "delta_pct=0.05" or "bottom 5%".]
  • [Second driver — one-sentence observation with ordinal peer language]
  • [Third driver — one-sentence observation with ordinal peer language]

So what: [2–3 sentences — what does this signal competitively? What competitive posture is this bank likely to adopt? Do NOT name specific products (wealth, treasury, etc.) unless the tape explicitly signals them. Use generic language: "expect competitive actions across pricing and coverage focus."]

What ${perspectiveBankName} should do:
  • Defend: [client/wallet-facing action — protect ${perspectiveBankName}'s existing relationships from this competitor. Pre-empt outreach, lock in multi-product relationships, accelerate renewals. NEVER say "review our own X" or "evaluate our pricing" — that is internal housekeeping, not a competitive move]
  • Attack: [market-facing action — take share where this competitor is weakest. Inferences must be directionally consistent with the tape: if a bank's NPL improved, do NOT imply it is taking on riskier loans. If NIM expanded, do NOT imply it is uncompetitive on rates. Only use what the signal actually supports]
  • Monitor: [this competitor's market behavior next quarter — pricing signals, origination volumes, coverage moves. NOT an internal ${perspectiveBankName} review]

Watch next quarter: [Conditional IF/THEN signal — what to look for and what it would mean. Do NOT name specific products speculatively. Example: "Watch whether originations recover — if not, expect defensive repricing in shared segments."]

--- CRITICAL RULES ---
1. "What changed" bullets must be analytical observations in plain English. Do NOT echo Δ values, delta_pct, z-scores, or "deteriorating/worse_than_median" verbatim.
2. Use ordinal peer language ("worst in peer set", "led the peer group", "bottom quartile") — not percentile fractions.
3. Do NOT speculate on specific product lines (wealth management, treasury, mortgage, etc.) unless the tape explicitly contains a supporting signal. Describe competitive posture generically.
4. Defend, Attack, and Monitor must be client-facing or market-facing. No internal reviews, audits, or process changes.
5. Attack = going after clients, deals, wallet share. Not talent, not benchmarking.
6. TYPE A caveats get "(CAGR-based; verify next quarter)" — TYPE B gets "(headcount effect possible; verify next quarter)". Never mix.
7. Caveats appear naturally and only ONCE per bank.
8. Tone: crisp and banker-native. No filler phrases. No heavy adjectives ("severe", "devastating") unless 3+ drivers all confirm the same direction at |z| >= 2.

--- MARKET MOVERS TAPE ---
${tape}
${snapshotBlock}
`.trim();
}



// ----------------- component -----------------
export default function MarketMoversConcise({
    dataProvider,
    segmentKey,
    segmentLabel = "Segment",
    priorQuarter,
    currentQuarter,
    perspectiveBankName = "JPMorgan Chase",
    topN = 5,
    focusBankCert = null, // optional: always include selected bank row + rank
}) {
    // fail loud if not provided
    assert(dataProvider, "dataProvider prop is required");
    assert(typeof dataProvider.listPeerBanks === "function", "dataProvider.listPeerBanks must be a function");
    assert(typeof dataProvider.getBankKpis === "function", "dataProvider.getBankKpis must be a function");
    assert(priorQuarter && currentQuarter, "priorQuarter and currentQuarter are required");
    assert(priorQuarter !== currentQuarter, "priorQuarter and currentQuarter must differ");

    const [status, setStatus] = useState({ state: "idle", message: "" });
    const [peers, setPeers] = useState([]);
    const [kpisByQuarterByCert, setKpisByQuarterByCert] = useState({});
    const [skippedPeers, setSkippedPeers] = useState([]);
    const [tape, setTape] = useState("");
    const [focusBankSnapshot, setFocusBankSnapshot] = useState(null);
    // Objective override: pre-filled from auto-inference, editable by the user.
    // If the user clears it, Gemini gets no posture hint (intentional).
    const [objectiveOverride, setObjectiveOverride] = useState("");
    const [geminiOut, setGeminiOut] = useState("");
    const [geminiLoading, setGeminiLoading] = useState(false);
    const [geminiError, setGeminiError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            setStatus({ state: "loading", message: "Loading peers…" });
            try {
                const peerBanks = await dataProvider.listPeerBanks({ segmentKey, quarter: currentQuarter, focusCert: focusBankCert });
                assert(Array.isArray(peerBanks) && peerBanks.length >= 5, "Peer list must have at least 5 banks");
                peerBanks.forEach((b) => {
                    assert(b.cert, "Peer bank missing cert");
                    assert(b.name, `Peer bank missing name for cert=${b.cert}`);
                });


                setStatus({ state: "loading", message: "Fetching KPIs for both quarters…" });
                const quarters = [priorQuarter, currentQuarter];

                // Per-peer fetch: catch individual failures and skip that peer.
                // A missing quarter for one bank (e.g. late FDIC filing) should not crash the whole run.
                const skipped = [];
                const certToName = Object.fromEntries(peerBanks.map((b) => [b.cert, b.name]));

                // Collect per-cert, per-quarter results — null means that cert is excluded
                const kpiPerCertPerQuarter = {}; // cert -> { q -> kpis }
                for (const b of peerBanks) kpiPerCertPerQuarter[b.cert] = {};

                for (const q of quarters) {
                    const results = await Promise.allSettled(
                        peerBanks.map(async (b) => {
                            const kpis = await dataProvider.getBankKpis({ cert: b.cert, quarter: q });
                            validateKpis(kpis);
                            return { cert: b.cert, kpis };
                        })
                    );
                    results.forEach((r, i) => {
                        const cert = peerBanks[i].cert;
                        if (r.status === "fulfilled") {
                            kpiPerCertPerQuarter[cert][q] = r.value.kpis;
                        } else {
                            // Mark as failed — will be excluded after both quarters run
                            kpiPerCertPerQuarter[cert][q] = null;
                            console.warn(`Skipping cert=${cert} (${certToName[cert]}) for ${q}: ${r.reason?.message}`);
                        }
                    });
                }

                // Only keep peers that have complete data for BOTH quarters
                const completePeers = peerBanks.filter(
                    (b) => quarters.every((q) => kpiPerCertPerQuarter[b.cert][q] !== null)
                );
                const skippedBanks = peerBanks.filter(
                    (b) => !completePeers.includes(b)
                ).map((b) => b.name);

                if (skippedBanks.length > 0) skipped.push(...skippedBanks);

                assert(
                    completePeers.length >= 5,
                    `Too many peers have incomplete data: only ${completePeers.length} of ${peerBanks.length} have records for both ${priorQuarter} and ${currentQuarter}. Analysis requires at least 5. Skipped: ${skippedBanks.join(", ")}`
                );

                // Build the fetched map from complete peers only
                const fetched = {};
                for (const q of quarters) {
                    fetched[q] = {};
                    for (const b of completePeers) fetched[q][b.cert] = kpiPerCertPerQuarter[b.cert][q];
                }

                if (cancelled) return;
                setPeers(completePeers);  // only peers with complete data for BOTH quarters
                setSkippedPeers(skipped);
                setKpisByQuarterByCert(fetched);
                setStatus({ state: "ready", message: "" });
            } catch (e) {
                if (cancelled) return;
                setStatus({ state: "error", message: String(e.message || e) });
            }
        }

        run();
        return () => {
            cancelled = true;
        };
    }, [dataProvider, segmentKey, priorQuarter, currentQuarter, focusBankCert]);

    const computed = useMemo(() => {
        if (status.state !== "ready") return null;
        assert(kpisByQuarterByCert[priorQuarter], "Missing priorQuarter KPI map");
        assert(kpisByQuarterByCert[currentQuarter], "Missing currentQuarter KPI map");

        const { top, rankByCert, focusRow } = computeMovers({
            peers,
            kpisByQuarterByCert,
            priorQuarter,
            currentQuarter,
            topN,
            focusCert: focusBankCert,
        });

        const focusRank = focusRow ? rankByCert.get(focusRow.cert) : null;

        const tapeStr = buildConciseTape({
            segmentLabel,
            peerCount: peers.length,
            priorQuarter,
            currentQuarter,
            moversTop: top,
            focusRow,
            focusRank,
        });

        // Build perspective bank snapshot (only if focus bank is in the peer set + has current-quarter data)
        let snapshot = null;
        if (focusBankCert && kpisByQuarterByCert[currentQuarter]?.[focusBankCert]) {
            const focusKpis = kpisByQuarterByCert[currentQuarter][focusBankCert];
            const allPeerKpisArray = Object.values(kpisByQuarterByCert[currentQuarter]);
            try {
                const { rows, quartileByKey } = buildFocusBankSnapshot(focusKpis, allPeerKpisArray);
                const objective = inferObjective(quartileByKey);
                snapshot = { rows, quartileByKey, objective };
            } catch (e) {
                // Non-fatal: snapshot is additive, not required
                console.warn("Perspective bank snapshot build failed:", e.message);
            }
        }

        return { tapeStr, focusRow, focusRank, top, snapshot };
    }, [status.state, kpisByQuarterByCert, peers, priorQuarter, currentQuarter, topN, focusBankCert, segmentLabel]);

    useEffect(() => {
        if (computed?.tapeStr) setTape(computed.tapeStr);
        if (computed?.snapshot !== undefined) {
            setFocusBankSnapshot(computed.snapshot);
            // Seed override with auto-inferred objective (only on first compute, not on re-renders)
            if (computed.snapshot?.objective) {
                setObjectiveOverride((prev) => prev || computed.snapshot.objective);
            }
        }
    }, [computed]);

    async function onSendToGemini() {
        assert(typeof dataProvider.generateGeminiText === "function", "Wire dataProvider.generateGeminiText(prompt) to your Gemini call");
        setGeminiOut("");
        setGeminiError(null);
        setGeminiLoading(true);
        try {
            // Merge objective override into snapshot before sending — user text wins, blank = no hint
            const snapshotWithOverride = focusBankSnapshot
                ? { ...focusBankSnapshot, objective: objectiveOverride.trim() || focusBankSnapshot.objective }
                : null;
            const prompt = buildGeminiPrompt({ tape, perspectiveBankName, focusBankSnapshot: snapshotWithOverride });
            const out = await dataProvider.generateGeminiText({ prompt });
            assert(typeof out === "string" && out.trim().length > 0, "Gemini returned empty response");
            setGeminiOut(out);
        } catch (err) {
            console.error("Gemini Analysis Error (Sidecar):", err);
            setGeminiError(err.message || String(err));
        } finally {
            setGeminiLoading(false);
        }
    }

    return (
        <div className="p-5">
            <h2 className="text-2xl font-bold mb-4">Market Movers (Concise)</h2>

            <div className="opacity-85 mb-4 space-y-1">
                <div className="flex gap-2 text-sm"><b className="text-blue-400">Segment:</b> <span>{segmentLabel}</span></div>
                <div className="flex gap-2 text-sm"><b className="text-blue-400">Period:</b> <span>{priorQuarter} → {currentQuarter}</span></div>
                <div className="flex gap-2 text-sm"><b className="text-blue-400">Perspective:</b> <span>{perspectiveBankName}</span></div>
            </div>

            {skippedPeers.length > 0 && status.state === "ready" && (
                <div className="mb-4 flex items-start gap-2 bg-yellow-900/20 border border-yellow-700/50 text-yellow-400 text-xs font-mono px-4 py-2.5 rounded-lg">
                    <span className="mt-0.5">⚠</span>
                    <span>
                        <b>{skippedPeers.length} peer{skippedPeers.length > 1 ? 's' : ''} excluded</b> — missing data for {priorQuarter} or {currentQuarter}:{' '}
                        {skippedPeers.join(', ')}
                    </span>
                </div>
            )}

            {status.state === "loading" && (
                <div className="flex flex-col items-center justify-center p-12 space-y-4 bg-gray-800/50 rounded-xl border border-gray-700 animate-pulse">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
                    <p className="text-gray-400 font-medium">{status.message}</p>
                </div>
            )}



            {status.state === "error" && (
                <div className="bg-red-900/20 border-l-4 border-red-500 p-6 rounded-r-lg max-w-2xl mt-4">
                    <div className="flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h4 className="text-red-400 font-bold text-lg">System Failure</h4>
                    </div>
                    <p className="mt-2 text-red-300 ml-9 font-mono text-sm">{status.message}</p>
                </div>
            )}

            {status.state === "ready" && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="mt-4">
                        <div className="flex justify-between items-center mb-2">
                            <div className="font-bold text-blue-300 uppercase tracking-wider text-xs">Intelligence Tape</div>
                            <span className="text-[10px] text-gray-500 font-mono">READY_FOR_TRANSMISSION</span>
                        </div>
                        <pre className="background-[#000] text-gray-300 p-5 rounded-xl overflow-auto border border-gray-800 leading-relaxed text-sm font-mono shadow-inner bg-black">
                            {tape}
                        </pre>
                    </div>

                    {/* Objective override — shown when snapshot is available */}
                    {focusBankSnapshot && (
                        <div className="mt-4 flex items-center gap-3 bg-gray-800/60 border border-gray-700 rounded-lg px-4 py-2.5">
                            <span className="text-xs text-gray-400 whitespace-nowrap font-mono shrink-0">📎 Posture:</span>
                            <input
                                id="objective-override"
                                type="text"
                                value={objectiveOverride}
                                onChange={(e) => setObjectiveOverride(e.target.value)}
                                placeholder="auto-inferred (clear to omit from prompt)"
                                className="flex-1 bg-transparent text-gray-200 text-xs font-mono border-none outline-none placeholder-gray-600"
                            />
                        </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-4 items-center">
                        <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(tape)}
                            className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-6 py-2.5 rounded-full transition-all text-sm font-bold border border-gray-700 active:scale-95 flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                            Copy Tape
                        </button>

                        <button
                            type="button"
                            onClick={onSendToGemini}
                            disabled={geminiLoading}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all transform active:scale-95 shadow-lg ${geminiLoading
                                ? 'bg-blue-800 opacity-80 cursor-not-allowed'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white hover:shadow-blue-500/20'
                                }`}
                        >
                            {geminiLoading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span>Generating...</span>
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-300" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                                    </svg>
                                    <span>Analyze with Gemini</span>
                                </>
                            )}
                        </button>
                    </div>

                    {geminiError && (
                        <div className="bg-red-900/20 border-l-4 border-red-500 p-6 rounded-r-lg max-w-2xl mt-8 animate-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center gap-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <h4 className="text-red-400 font-bold text-lg">Analysis Failed</h4>
                            </div>
                            <p className="mt-2 text-red-300 ml-9 font-medium">{geminiError}</p>
                        </div>
                    )}

                    {geminiOut && (
                        <div className="mt-10 animate-in fade-in slide-in-from-top-4 duration-700">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-blue-500/20 rounded-lg">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="font-bold text-blue-300 uppercase tracking-widest text-[10px]">Intelligence Report</div>
                                    <div className="text-gray-400 text-xs">Model: Gemini 2.5 Flash</div>
                                </div>
                            </div>
                            <div className="whitespace-pre-wrap leading-relaxed border border-gray-800 rounded-xl p-8 bg-[#0b0f1a] text-gray-200 text-base shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => navigator.clipboard.writeText(geminiOut)}
                                        className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors"
                                        title="Copy Report"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                        </svg>
                                    </button>
                                </div>
                                {geminiOut}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
