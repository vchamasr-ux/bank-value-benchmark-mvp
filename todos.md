# Project Checklist: AI-Driven Value Benchmark Calculator

## Phase 0: Project Initialization & Setup
- [ ] **Scaffold Project**
    - [ ] Initialize React + Vite project.
    - [ ] Install Tailwind CSS and configure `tailwind.config.js`.
    - [ ] Install visualization library: `npm install recharts`.
    - [ ] Install utility for class names (optional but recommended): `npm install clsx tailwind-merge`.
    - [ ] Clean up default Vite boilerplate (remove `App.css`, default logos).

## Phase 1: The "Hook" - FDIC Data Integration
- [ ] **Bank Search Architecture**
    - [ ] Create `src/services/fdicService.js`.
    - [ ] Implement `searchBank(name)` function using FDIC API endpoint: `https://banks.data.fdic.gov/api/institutions`.
    - [ ] Create `BankSearch` component with an input field and "Search" button.
    - [ ] Display search results list (Bank Name, City, State, `CERT` ID).
    - [ ] **Test:** Verify "Main Street Bank" returns valid JSON results.

- [ ] **Financial Data Fetching**
    - [ ] In `fdicService.js`, implement `getBankFinancials(certId)` to fetch Call Report data.
    - [ ] *Note:* Identify correct RIS fields for Net Income, Assets, Expenses, etc.
    - [ ] Create `src/utils/kpiCalculator.js`.
    - [ ] Implement formulas for the 5 Financial KPIs:
        - [ ] **Efficiency Ratio:** (Non-interest Exp) / (Net Interest Income + Non-interest Inc).
        - [ ] **Cost of Funds:** (Interest Exp) / (Average Assets).
        - [ ] **Non-Interest Income %:** (Non-interest Inc) / (Total Income).
        - [ ] **Yield on Loans:** (Interest Income on Loans) / (Total Loans).
        - [ ] **Assets per Employee:** (Total Assets) / (Num Employees).

## Phase 2: Visualization - Financial Gauges
- [ ] **Gauge Component**
    - [ ] Create `src/components/GaugeChart.jsx` using Recharts (PieChart with startAngle 180, endAngle 0).
    - [ ] Define props: `value`, `min`, `max`, `label`, `average` (benchmark marker).
    - [ ] Implement color logic: Red (Poor), Yellow (Average), Green (Good).
    
- [ ] **Financial Dashboard UI**
    - [ ] Create `FinancialDashboard` component.
    - [ ] Fetch data upon selecting a bank from the Search list.
    - [ ] Render 5 `GaugeChart` instances with real calculated data.
    - [ ] **Test:** Compare calculated values against a known public source (e.g., UBPR) to ensure math is correct.

## Phase 3: The "Exchange" - Operational Data & Locking
- [ ] **Seed Data**
    - [ ] Create `src/data/operationalBenchmarks.json`.
    - [ ] Populate with Tier 4/5 Bank estimated averages:
        - [ ] Digital Adoption Rate (~60%).
        - [ ] Digital Account Opening % (~25%).
        - [ ] Vendor Spend % (~10-15% of OpEx).
        - [ ] Avg. Age of Customer (~52 years).
        - [ ] Net Promoter Score (~50).

- [ ] **Locked UI State**
    - [ ] Create `OperationalSection` component.
    - [ ] Build the "Blurred/Locked" overlay state.
    - [ ] Add the "Unlock Your Scorecard" Call-to-Action (CTA).

- [ ] **Input Form**
    - [ ] Create `DataInputForm` component inside the overlay.
    - [ ] Add 5 numeric inputs corresponding to the operational KPIs.
    - [ ] Add validation (ensure numbers are within 0-100 ranges where applicable).

## Phase 4: Integration & The "Unlock"
- [ ] **Unlock Logic**
    - [ ] Create state handler: `isUnlocked` (boolean).
    - [ ] On form submit: Save user inputs to state and set `isUnlocked = true`.
    - [ ] Remove blur overlay.

- [ ] **Operational Visualization**
    - [ ] Render 5 new `GaugeChart` instances for the Operational KPIs.
    - [ ] Map `value` = User Input.
    - [ ] Map `average` = Seed Data from JSON.

## Phase 5: Polish & UX
- [ ] **Error Handling**
    - [ ] Add error message if FDIC API is down or bank not found.
    - [ ] Add "Loading..." spinners during API fetches.
- [ ] **Reset Flow**
    - [ ] Add a "New Search" button in the header to clear state and return to Step 1.
- [ ] **Responsive Design**
    - [ ] Ensure gauges resize correctly on mobile vs. desktop.
- [ ] **Final Review**
    - [ ] Verify the "Give-to-Get" flow feels smooth.