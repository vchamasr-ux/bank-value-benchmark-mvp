# Bank Value Benchmark

The **Bank Value Benchmark** is a React-based single-page application (SPA) designed to help community banks compare their performance against peer institutions. By leveraging live data from the FDIC Public API and AI-powered insights via Google's Gemini, the application provides an interactive, real-time dashboard for financial health and competitive analysis.

## Features

- **Financial Health Scorecard**: Automated comparison of key financial KPIs against a dynamically-generated peer group based on FDIC data.
- **Operational Efficiency Dashboard**: An interactive module to benchmark operational metrics against industry seed data (Give-to-Get model).
- **Market Movers (Competitive Radar)**: Identifies top quarter-over-quarter movers within a peer segment using robust statistical analysis (Z-Scores).
- **Strategic Planner (What-If Scenarios)**: Analyzes how operational and strategic changes impact KPIs.
- **AI Financial Summaries**: Generates executive-level strategic briefings of financial performance using Google's Gemini AI, gated by LinkedIn authentication.
- **Geographic & Branch Overlap Mapping**: Visualizes branch footprints for M&A target analysis.

## Tech Stack

- **Frontend**: React 19, Vite 7
- **Styling**: Tailwind CSS 4.x
- **Visualizations**: Recharts (Gauge charts, sparklines, etc.), React Simple Maps
- **Data Source**: FDIC Public API (client-side fetching)
- **AI Integration**: Google Gemini 2.5 Flash via Serverless Functions
- **Authentication**: LinkedIn OAuth 2.0
- **Deployment & Serverless**: Vercel (KV for quota limits, serverless functions for API proxying)

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
   Create a `.env.local` file in the root directory for local development. See the `.env.local` or environment config for required keys:
   - `VITE_GEMINI_API_KEY` (For local AI testing)
   - `LINKEDIN_CLIENT_ID`
   - `LINKEDIN_CLIENT_SECRET`
   - Vercel KV details (for local testing of quota features)

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

## Documentation

For deep-dives into the architecture and feature specifications, please see the `docs/` directory:
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - System design, data flow, and components.
- [`docs/FEATURES.md`](docs/FEATURES.md) - Detailed breakdown of the application modules and their logic.

## License

All rights reserved.
