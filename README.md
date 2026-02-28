# Bank Value Benchmark

The **Bank Value Benchmark** is a React-based single-page application (SPA) designed to help community banks compare their performance against peer institutions. By leveraging live data from the FDIC Public API and AI-powered insights via Google's Gemini, the application provides an interactive, real-time dashboard for financial health and competitive analysis.

## Features

- **Financial Health Scorecard**: Automated comparison of 9 financial KPIs against a dynamically-generated peer group based on FDIC data (P25/P75 quartile gauges).
- **Operational Efficiency Dashboard**: An interactive "Give-to-Get" module to benchmark operational metrics against industry seed data.
- **Market Movers (Competitive Radar)**: Identifies top quarter-over-quarter movers within a peer segment using robust Z-Score analysis.
- **Strategic Planner (What-If Scenarios)**: Analyzes how operational and strategic changes impact KPIs using ML linear models.
- **AI Financial Summaries**: Generates executive-level strategic briefings via Google's Gemini AI, gated by LinkedIn authentication with a 2/day quota.
- **Pitchbook Presentation Mode**: Full-screen 5-slide IB-style deck with keyboard navigation, embedding gauges, market movers, and AI insights.
- **PDF Export**: `react-to-print` pipeline producing a 4-slide print-ready professional report.
- **HTML Brief Export**: Standalone self-contained `.html` executive brief, auto-downloaded from the browser.
- **Saved Briefs**: Save, view, and delete AI-generated financial summaries and competitive briefs, stored persistently per user in Vercel KV.
- **Geographic & Branch Overlap Mapping**: Visualizes branch footprints for M&A target analysis.

## Tech Stack

- **Frontend**: React 19, Vite 7
- **Styling**: Tailwind CSS 4.x
- **Visualizations**: Recharts (Gauge charts, sparklines), React Simple Maps
- **Data Source**: FDIC Public API (client-side fetching)
- **AI Integration**: Google Gemini 2.5 Flash via Serverless Functions
- **Authentication**: LinkedIn OAuth 2.0
- **Deployment & Serverless**: Vercel (KV for quota + brief storage, serverless functions for API proxying)
- **PDF Export**: `react-to-print`

## Local Development

### Prerequisites

- Node.js (v18+ recommended)
- `npm` or `yarn`

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env.local` file in the root directory. Required:
   - `GEMINI_API_KEY` — Server-side Gemini key
   - `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` — LinkedIn OAuth credentials
   - `KV_URL` — Vercel KV (Redis) connection URL
   - `VITE_GEMINI_API_KEY` — _(local dev only)_ Client-side Gemini key for dev without auth
   - `ADMIN_LINKEDIN_SUBS` — _(optional)_ Comma-separated sub IDs for unlimited quota
   - `RESEND_API_KEY` — _(optional)_ For registration email notifications

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

## Documentation

For deep-dives into the architecture and feature specifications, see the documentation files in the root and `docs/` directory:

- [`context.md`](context.md) — Full feature context and module descriptions.
- [`blueprint.md`](blueprint.md) — Architecture blueprint, data flows, and phase history.
- [`specifications.md`](specifications.md) — Technical spec, project structure, and env vars.
- [`todos.md`](todos.md) — Phase-by-phase checklist and open future work.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — System design and component structure.
- [`docs/FEATURES.md`](docs/FEATURES.md) — Detailed breakdown of modules and logic.

## License

All rights reserved.
