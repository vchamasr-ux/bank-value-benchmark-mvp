import { kv } from "@vercel/kv";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { financials, benchmarks, type, tapeStr, snapshotBlock, perspectiveBankName } = req.body;

    // Get identification from header
    const linkedinSub = req.headers['x-linkedin-sub'];
    const linkedinName = req.headers['x-linkedin-name'];

    if (!linkedinSub) {
        return res.status(401).json({ error: "Authentication required" });
    }

    if (!process.env.GEMINI_API_KEY) {
        console.error("CRITICAL: GEMINI_API_KEY is missing");
        return res.status(500).json({ error: "Server configuration error: Missing API Key" });
    }

    // 1. Quota Check (2 calls per day)
    // Key format: quota:linkedin_sub:YYYY-MM-DD (America/New_York)
    const nyDate = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());

    // Format MM/DD/YYYY to YYYY-MM-DD
    const [m, d, y] = nyDate.split('/');
    const today = `${y}-${m}-${d}`;
    const quotaKey = `quota:${linkedinSub}:${today}`;

    const admins = (process.env.ADMIN_LINKEDIN_SUBS || '').split(',');
    const isAdmin = admins.includes(linkedinSub) || linkedinName === 'Vincent Chamasrour';

    if (!isAdmin) {
        try {
            const usage = await kv.get(quotaKey) || 0;
            if (usage >= 2) {
                const tomorrow = new Date();
                tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
                tomorrow.setUTCHours(0, 0, 0, 0);
                return res.status(429).json({ error: "Daily quota exceeded", reset_at: tomorrow.toISOString() });
            }
            await kv.incr(quotaKey);
            await kv.expire(quotaKey, 172800);
        } catch (kvError) {
            console.error("KV Quota Error:", kvError);
            return res.status(500).json({ error: "Storage error: Failed to verify quota" });
        }
    }

    // 2. AI Generation
    try {
        let prompt = "";

        if (type === 'market_movers') {
            prompt = `
You are a competitive-intelligence analyst writing for senior bankers at ${perspectiveBankName}. Use ONLY the data in the tape below. Do not invent numbers or add facts not present in the tape.

--- DEFINITIONS ---
- "Δ" = QoQ change (current quarter minus prior quarter).
- delta_pct = percentile rank of a bank's delta within the peer group (0..1). It is NOT a percent change.
- z = robust z-score: (bank delta − peer median delta) / peer IQR. 
- strength = High / Medium / Low. Always use this 'strength' label to describe the magnitude of change, rather than interpreting raw z-scores.
- "improving / deteriorating" = objective direction relative to the metric's "better" side.
- "vs_peers_effect" = shows whether the bank moved in a more favorable direction than the median peer.

--- STRATEGIC PHRASING (Softened Intent) ---
Do NOT assert intent confidently (e.g., "prioritizing growth", "strategic pivot"). 
Instead, use pattern-based language: 
"The pattern is consistent with margin-first behavior, either strategic or driven by mix/funding conditions."
"Performance suggests a defensive posture in funding costs."

--- METRIC RULES & CAVEATS ---
1. EXACT UNITS: You MUST preserve the exact units shown in the tape for every metric (e.g., bp, %, ratio). Do not convert units.
2. CONTEXT-ONLY METRICS: If a metric is flagged as metric_class="derived" (e.g., 3Y Growth CAGR) or metric_class="denominator-sensitive" (e.g., Assets per Employee):
   - You may include it as a driver, but you MUST treat it primarily as context for other moves.
   - If it is the top driver, you MUST add specific caveat language (e.g., "CAGR-based; verify next quarter before concluding trend break" or "headcount effect possible; verify next quarter").
3. NOISY METRICS: Non-Interest Income % or Efficiency Ratio. At subsidiary level, these can be distorted by internal allocations. If a swing is catastrophic/unprecedented (strength=High), flag as "(possible data/reporting artifact)".

--- CONFIDENCE RUBRIC (Deterministic) ---
Assign exactly one Confidence: High / Medium / Low.
Identify the TOP DRIVER (highest strength).
- High   = Magnitude high (strength=High) AND at least 2 metrics agree on direction AND no fragile/noisy/derived metrics involved as the primary anchor.
- Medium = Magnitude high (strength=High) but only 1 metric supports the move OR signals are partially mixed.
- Low    = Magnitude high but driven by derived/denominator-sensitive metrics OR extreme single-metric outlier OR possible reporting/data artifact.

--- OUTPUT FORMAT (Exactly as shown) ---

[BANK NAME] — Theme: [theme label] ([Threat / Opportunity / Monitor]) | Confidence: [High / Medium / Low]
What changed (QoQ):
  • [Insight 1: One-sentence analytical observation using ordinal language ("worst in the peer set", "top quartile")]
    Evidence: [Numbers: "Metric Label: {bank_delta} QoQ, peer median {peer_median} (delta_pct={value}) | strength={strength}"]
  • [Insight 2: Analytical observation]
    Evidence: [Numbers line preserving exact units]
  • [Insight 3: Analytical observation]
    Evidence: [Numbers line preserving exact units]

So what: [2–3 sentences. Link the pattern to likely market behavior.]

What ${perspectiveBankName} should do:
  • Defend: [What external relationships to protect / what not to do.]
  • Attack: [Where to take expected market share / what wedge to use.]
  • Monitor: [What specific external signals/behavior to watch next quarter.]

  [CRITICAL PLAYBOOK RULES: FORBID internal housekeeping / inward-facing initiatives (e.g., "improve our efficiency", "streamline operations"). FORBID product-line speculation UNLESS explicitly supported by tape data (e.g., do not say "they are pushing wealth management").]

Watch next quarter: [Conditional IF/THEN signal based on trend confirmation.]

--- MARKET MOVERS TAPE ---
${tapeStr}
${snapshotBlock}
`.trim();
        } else {
            // Default: financial_summary
            const bankName = financials?.name || financials?.raw?.NAME || 'the bank';
            const bankLocation = financials?.raw?.CITY && financials?.raw?.STALP ? `${financials.raw.CITY}, ${financials.raw.STALP}` : '';
            const promptData = { financials, benchmarks };

            prompt = `You are a financial analyst. Analyze the following financial and benchmark data for ${bankName}${bankLocation ? ` based in ${bankLocation}` : ''}. 
CRITICAL CONTEXT: 
1. ALL absolute dollar values in the raw FDIC data are denominated in THOUSANDS of US Dollars ($000s). For example, "3800000" means $3.8 Billion. Use Billion/Million terminology correctly.
2. The benchmark data provides averages for a peer group. Focus on proportional metrics (ratios, margins, percentages).

Provide a detailed, professional summary of their financial health.
IMPORTANT: Start with a very brief (1-2 sentences) introductory overview about the bank itself based on your knowledge.
Highlight strengths and weaknesses compared to the peer group. Use Markdown formatting.

Data:
${JSON.stringify(promptData, null, 2)}`;
        }

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return res.status(200).json({ text });
    } catch (error) {
        console.error("Gemini Server Error:", error);

        // Pass through 429 Rate Limit errors specifically
        if (error.message && (error.message.includes('429') || error.message.includes('quota'))) {
            return res.status(429).json({ error: error.message });
        }

        return res.status(500).json({ error: error.message || "Failed to generate summary" });
    }
}
