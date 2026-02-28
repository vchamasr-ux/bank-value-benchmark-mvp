
import { kv } from "@vercel/kv";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { financials, benchmarks, type, tapeStr, snapshotBlock, perspectiveBankName } = req.body;

    // #10 — Validate type field; silently falling through causes wrong AI path on typo
    const VALID_TYPES = ['market_movers', 'financial_summary', undefined];
    if (!VALID_TYPES.includes(type)) {
        return res.status(400).json({ error: `Invalid type: "${type}". Must be one of: market_movers, financial_summary.` });
    }

    // Get identification from header
    const linkedinSub = req.headers['x-linkedin-sub'];

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

    const admins = (process.env.ADMIN_LINKEDIN_SUBS || '').split(',').map(s => s.trim()).filter(Boolean);
    const isAdmin = admins.includes(linkedinSub);

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
        let result;
        let prompt = "";

        if (type === 'market_movers') {
            prompt = `
You are a competitive-intelligence analyst writing for senior bankers at ${perspectiveBankName}. Use ONLY the data in the tape below. Do not invent numbers or add facts not present in the tape.

--- DEFINITIONS ---
- "Δ" = QoQ change (current quarter minus prior quarter).
- delta_pct = percentile rank of a bank's delta within the peer group (0..1). It is NOT a percent change.
- z = robust z-score: (bank delta − peer median delta) / peer IQR. 
- strength = High / Medium / Low. Always use this 'strength' label to describe the magnitude of change.
- "vs_peers_effect" = shows whether the bank moved in a more favorable direction than the median peer.

--- STRATEGIC PHRASING (Softened Intent) ---
Do NOT assert intent confidently (e.g., "prioritizing growth", "strategic pivot"). 
Instead, use pattern-based language: "The pattern is consistent with margin-first behavior."

--- METRIC RULES & CAVEATS ---
1. EXACT UNITS: You MUST preserve the exact units shown in the tape for every metric (e.g., bp, %, ratio). Do not convert units. If the tape includes an '| Est. Annualized Impact: ...' clause, YOU MUST append it exactly as written at the end of the evidence string. No exceptions.
2. CONTEXT-ONLY METRICS: If a metric is flagged as metric_class="derived" or "denominator-sensitive", you MUST treat it primarily as context. Add specific caveat language (e.g., "CAGR-based; verify next quarter").
3. NOISY METRICS: Non-Interest Income % or Efficiency Ratio. If a swing is catastrophic, flag as "(possible data/reporting artifact)".
4. SUPERLATIVE LANGUAGE: ONLY use phrases like "worst in the peer set" or "best in the peer group" if delta_pct <= 0.06 or >= 0.94. Otherwise, use relative language like "bottom quartile" or "lagged median peers".
5. NO ARTIFACT EXCUSES FOR CORE KPIs: Do NOT label changes as "possible artifacts" unless they belong to metric_class="derived" or "denominator-sensitive", OR if a core metric is noted as "NOISY" in rule 3 above.

--- CONFIDENCE RUBRIC (Deterministic) ---
Use the strictly calculated Computed Confidence provided in the tape for each bank. Do not guess the confidence.

--- PLAYBOOK RULES ---
FORBID internal housekeeping / inward-facing initiatives. FORBID product-line speculation UNLESS explicitly supported by tape data.

--- MARKET MOVERS TAPE ---
${tapeStr}
${snapshotBlock}
`.trim();

            const schema = {
                type: SchemaType.OBJECT,
                properties: {
                    ecosystem_synthesis: {
                        type: SchemaType.OBJECT,
                        description: "A single executive synthesis connecting the dots across all banks analyzed.",
                        properties: {
                            executive_summary: { type: SchemaType.STRING, description: "A 2-3 sentence executive synthesis that connects the dots across all the individual bank briefs, identifying overarching industry trends." },
                            macro_opportunity: { type: SchemaType.STRING, description: "The single biggest macro-opportunity for the perspective bank." }
                        },
                        required: ["executive_summary", "macro_opportunity"]
                    },
                    banks: {
                        type: SchemaType.ARRAY,
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                bank_name: { type: SchemaType.STRING, description: "Name of the competitor bank" },
                                theme: { type: SchemaType.STRING, description: "Theme label for the pattern observed" },
                                threat_level: { type: SchemaType.STRING, description: "The strategic urgency", enum: ["Threat", "Opportunity", "Monitor"] },
                                confidence: { type: SchemaType.STRING, description: "High / Medium / Low from tape", enum: ["High", "Medium", "Low"] },
                                what_changed: {
                                    type: SchemaType.ARRAY,
                                    description: "List of 3 primary driver insights.",
                                    items: {
                                        type: SchemaType.OBJECT,
                                        properties: {
                                            insight: { type: SchemaType.STRING, description: "Analytical observation." },
                                            evidence: { type: SchemaType.STRING, description: "Exact numbers from the tape: Metric Label: X, peer median Y | strength=Z" }
                                        },
                                        required: ["insight", "evidence"]
                                    }
                                },
                                so_what: { type: SchemaType.STRING, description: "2–3 sentences linking the pattern to likely market behavior." },
                                actions: {
                                    type: SchemaType.OBJECT,
                                    properties: {
                                        defend: { type: SchemaType.STRING, description: "What external relationships to protect" },
                                        attack: { type: SchemaType.STRING, description: "Where to take expected market share" },
                                        monitor: { type: SchemaType.STRING, description: "What specific external signals/behavior to watch next quarter" }
                                    },
                                    required: ["defend", "attack", "monitor"]
                                },
                                watch_next_quarter: { type: SchemaType.STRING, description: "Conditional IF/THEN signal based on trend confirmation." }
                            },
                            required: ["bank_name", "theme", "threat_level", "confidence", "what_changed", "so_what", "actions", "watch_next_quarter"]
                        }
                    }
                },
                required: ["ecosystem_synthesis", "banks"]
            };

            result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                }
            });

        } else {
            // Default: financial_summary
            // #5 — Project to curated KPI shape instead of sending the full financials object
            // (which includes 20 quarters of raw history). Reduces token use and avoids context overflows.
            const kpiSlim = financials ? {
                reportDate: financials.reportDate,
                efficiencyRatio: financials.efficiencyRatio,
                netInterestMargin: financials.netInterestMargin,
                costOfFunds: financials.costOfFunds,
                returnOnAssets: financials.returnOnAssets,
                returnOnEquity: financials.returnOnEquity,
                nptlRatio: financials.nptlRatio,
                yieldOnLoans: financials.yieldOnLoans,
                assetGrowth3Y: financials.assetGrowth3Y,
                loanGrowth3Y: financials.loanGrowth3Y,
                depositGrowth3Y: financials.depositGrowth3Y,
                raw: {
                    NAME: financials.raw?.NAME,
                    CITY: financials.raw?.CITY,
                    STALP: financials.raw?.STALP,
                    ASSET: financials.raw?.ASSET,
                }
            } : null;

            const benchSlim = benchmarks ? {
                groupName: benchmarks.groupName,
                sampleSize: benchmarks.sampleSize,
                efficiencyRatio: benchmarks.efficiencyRatio,
                netInterestMargin: benchmarks.netInterestMargin,
                costOfFunds: benchmarks.costOfFunds,
                returnOnAssets: benchmarks.returnOnAssets,
                returnOnEquity: benchmarks.returnOnEquity,
                nptlRatio: benchmarks.nptlRatio,
                yieldOnLoans: benchmarks.yieldOnLoans,
                assetGrowth3Y: benchmarks.assetGrowth3Y,
            } : null;

            const promptData = { financials: kpiSlim, benchmarks: benchSlim };

            const bankName = financials?.raw?.NAME || "the subject bank";
            const bankLocation = financials?.raw?.CITY && financials?.raw?.STALP ? `${financials.raw.CITY}, ${financials.raw.STALP}` : "";

            prompt = `You are a financial analyst. Analyze the following financial and benchmark data for ${bankName}${bankLocation ? ` based in ${bankLocation}` : ''}. 
CRITICAL CONTEXT: 
1. ALL absolute dollar values in the raw FDIC data are denominated in THOUSANDS of US Dollars ($000s). For example, "3800000" means $3.8 Billion. Use Billion/Million terminology correctly.
2. The benchmark data provides averages for a peer group. Focus on proportional metrics (ratios, margins, percentages).
3. All flow-based KPIs (ROA, ROE, NIM, Cost of Funds, Yield on Loans) are already annualized.

Provide a detailed, professional summary of their financial health.
IMPORTANT: Start with a very brief (1-2 sentences) introductory overview about the bank itself based on your knowledge.
Highlight strengths and weaknesses compared to the peer group. Use Markdown formatting.

Data:
${JSON.stringify(promptData, null, 2)}`;
            result = await model.generateContent(prompt);
        }

        const response = await result.response;
        const text = response.text();

        if (type === 'market_movers') {
            try {
                const parsed = JSON.parse(text);
                return res.status(200).json({ data: parsed });
            } catch (e) {
                console.error("Failed to parse JSON schema from Gemini:", e);
                return res.status(500).json({ error: "Failed to generate structured data." });
            }
        }

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
