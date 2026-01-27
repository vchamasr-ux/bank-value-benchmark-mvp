# Bank Value Benchmark - Application Specifications

## 1. Overview
The **Bank Value Benchmark** is a React-based web application designed to help community banks compare their performance against peer institutions. It provides two primary analytical views:
1.  **Financial Health Scorecard**: Automated comparison of financial KPIs against a relevant peer group derived from live FDIC data.
2.  **Operational Efficiency Scorecard**: A "Give-to-Get" interactive module where users benchmark operational metrics against industry standards.

## 2. Technical Stack
-   **Frontend Framework**: React 19 (Vite)
-   **Styling**: TailwindCSS 4.x (Utility-first CSS)
-   **Visualization**: Recharts (Custom Gauge Charts)
-   **Testing**: Vitest + React Testing Library + JSDOM
-   **Data Source**: FDIC Public API (Client-side fetching) available at `https://banks.data.fdic.gov/`

## 3. Core Architecture
The application runs entirely client-side (SPA). It dynamically fetches bank data and calculates benchmarks on the fly.

### 3.1 Data Flow
1.  **User Input**: User searches for a bank by name.
2.  **Identification**: App retrieves the bank's unique `CERT` ID from FDIC.
3.  **Financial Fetching**: App fetches the latest financial Call Report for that `CERT`.
4.  **Peer Group Generation**:
    *   App identifies the subject bank's Asset Class (e.g., $100M - $1B).
    *   App queries FDIC for a sample (N=20) of other active banks in that same asset class.
    *   It calculates aggregate averages and quartiles (P25, P75) for the sample.
5.  **Rendering**: Comparison data is passed to the Dashboard components for visualization.

## 4. Functional Modules

### 4.1 Bank Search (`BankSearch.jsx`)
-   **Input**: Text field with autocomplete behavior (simulated or direct).
-   **API Integration**: Queries `https://banks.data.fdic.gov/api/institutions/` with `filters=NAME:*term* AND ACTIVE:1`.
-   **Output**: Selectable list of active banks.

### 4.2 Financial Health Scorecard (`FinancialDashboard.jsx`)
Visualizes key financial performance indicators.
-   **Metrics Tracked**:
    1.  **Efficiency Ratio** (Lower is Better): `Non-Interest Exp / (Net Interest Income + Non-Interest Income)`
    2.  **Net Interest Margin** (Higher is Better): `Net Interest Income / Total Assets`
    3.  **Cost of Funds** (Lower is Better): `Interest Exp / Total Assets`
    4.  **Non-Interest Income %** (Higher is Better): `Non-Interest Income / Total Income`
    5.  **Yield on Loans** (Higher is Better): `Interest Income / Total Loans`
    6.  **Assets per Employee** (Higher is Better): `Total Assets / Num Employees`
-   **Peer Group Transparency**:
    *   Displays "Benchmark: Assets $X - $Y (N=20)".
    *   Clickable "N=20" badge opens a **Peer Group Modal**.
    *   **Modal**: Lists the specific 20 banks in the comparison sample with their Location and Total Assets.

### 4.3 Operational Efficiency Scorecard (`OperationalDashboard.jsx`)
Interactive module requiring user input to reveal benchmarks.
-   **Locked State**: Blurs the dashboard results until user submits data.
-   **Metrics**:
    1.  **Digital Adoption Rate** (%)
    2.  **Digital Account Opening** (%)
    3.  **Vendor Spend** (% of OpEx, Inverse metric)
    4.  **Avg Age of Customer** (Years, Inverse metric)
    5.  **Net Promoter Score** (NPS)
-   **Data Source**: Compares user input against static industry benchmarks stored in `operationalBenchmarks.json`.

### 4.4 Visualizations (`GaugeChart.jsx`)
Custom gauge component implementing Green/Yellow/Red zoning logic.
-   **Architecture**: Built on Recharts `PieChart`.
-   **Zones**: 3 equal sectors (Low, Mid, High) derived logically from the Average.
    *   *Visual Range*: Centered on the Average value.
-   **Needle**: Points to the subject bank's specific value.
-   **Context Makers**:
    *   Displays "Avg" numeric value text.
    *   Visually indicates P25/P75 ranges (if provided).
-   **Inverse Logic**: Automatically flips colors for metrics where "Lower is Better" (e.g., Efficiency Ratio), so that the "Green" zone is on the left (Low values).

## 5. Key Calculations (`kpiCalculator.js`)
All financial KPIs are calculated raw from FDIC Call Report fields:
-   `INTINC`: Total Interest Income
-   `INTEXP`: Total Interest Expense
-   `NONII`: Non-Interest Income
-   `NONIX`: Non-Interest Expense
-   `ASSET`: Total Assets
-   `LNLSNET`: Net Loans and Leases
-   `NUMEMP`: Number of Employees

*Note: Calculations handle unit conversions (thousands vs actual dollars) to ensure consistent percentage outputs.*

## 6. Known Constraints
-   **Browser Environment**: Requires `$HOME` environment variable to be set for local browser testing tools.
-   **API Rate Limits**: The app relies on the public FDIC API which may rate limit excessive requests.
