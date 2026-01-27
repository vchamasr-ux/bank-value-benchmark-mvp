The Blueprint: "Value Benchmark MVP"
Architecture: Single Page Application (SPA).

Frontend: React (Vite) + Tailwind CSS (for rapid styling).

Visualization: Recharts (for the Gauges).

Data Source A (Financials): FDIC BankFind API (Real-time public data).

Data Source B (Operational): A local "Seed Data" JSON file (The expert research benchmarks we defined) + User Inputs.

State Management: React Context (to manage the "Locked/Unlocked" state).

Phase 1: The Foundation & Real Data Pipeline
Goal: Get real financial data flowing from the FDIC API into a raw display.

Step 1: Search & Identification We need to find the specific bank first. The user types a name, we get a "Cert ID" (Certification Number).

Step 2: Financial Data Extraction Using the Cert ID, we fetch the specific Call Report data (Net Income, Assets, etc.) to calculate our 5 Financial KPIs.

Step 3: The Dashboard Skeleton Display these raw numbers to verify accuracy before making them pretty.

Phase 2: Visualization & The "Hook"
Goal: Turn raw numbers into the "Give-to-Get" experience.

Step 4: The Gauge Component Build a reusable Speedometer component using Recharts.

Step 5: The "Locked" UI Build the blurred section for Operational KPIs and the Input Form.

Step 6: The "Unlock" Logic Wire the form submission to reveal the Operational Gauges, comparing User Input vs. the Seed Data.

The Prompts
Copy and paste these prompts one by one into the Antigravity agent. Wait for the agent to complete the task and confirm it works in the preview browser before moving to the next prompt.

Prompt 1: Project Setup & Bank Search (FDIC API)
Markdown
I want to build a "Bank Value Benchmark" app using React, Vite, and Tailwind CSS. 
Let's start by building the "Bank Search" feature using real data.

1.  **Scaffold the App:** Set up a clean React app with Tailwind CSS.
2.  **Create a Service:** Create a file `src/services/fdicService.js`. Implement a function `searchBank(name)` that calls the public FDIC API (`https://banks.data.fdic.gov/api/institutions`) to search for a bank by name.
3.  **Create the UI:** In `App.jsx`, create a simple input field for "Bank Name" and a "Search" button.
4.  **Display Results:** When I search, display a list of matching banks (Name, City, State, and their `CERT` number).
5.  **Test:** Ensure I can type "First Community" and see a list of real banks returned from the API.
Prompt 2: Fetching & Calculating Financial KPIs
Markdown
Now that we have the Bank `CERT` number, let's fetch the financial data.

1.  **Update Service:** In `fdicService.js`, add a function `getBankFinancials(certId)` that fetches the latest financial data for that specific bank.
2.  **Calculate KPIs:** The API returns raw values. Create a utility `kpiCalculator.js` to calculate these 5 metrics from the raw data:
    * **Efficiency Ratio** (Non-interest Exp / (Net Interest Income + Non-interest Inc))
    * **Cost of Funds** (Interest Exp / Average Assets)
    * **Non-Interest Income %** (Non-interest Inc / Total Income)
    * **Yield on Loans** (Interest Income on Loans / Total Loans)
    * **Assets per Employee** (Total Assets / Num Employees)
3.  **Update UI:** When I click on a bank from the search list, fetch this data and display these 5 calculated KPIs as raw numbers in a "Financial Health" card.
Prompt 3: Visualizing with Recharts (The Gauges)
Markdown
The raw numbers are working. Now let's visualize them.

1.  **Install Recharts:** Add the library to the project.
2.  **Create Component:** Create a `GaugeChart.jsx` component. It should take `value`, `min`, `max`, and `average` as props.
3.  **Visual Style:** It should look like a semi-circle speedometer. Use distinct colors: Red (Poor), Yellow (Average), Green (Good).
4.  **Integrate:** Replace the raw numbers in `App.jsx` with 5 instances of this `GaugeChart`.
5.  **Benchmarks:** For now, pass hardcoded "Tier 4 Average" values (e.g., Efficiency Ratio: 60%) into the `average` prop so I can see the needle compare the specific bank's data against the industry average.
Prompt 4: The "Locked" Operational Section
Markdown
Now we implement the "Give-to-Get" logic.

1.  **Create Data Structure:** Create a file `src/data/operationalBenchmarks.json`. Populate it with our research data for the 5 Operational KPIs (Digital Adoption, DAO %, Vendor Spend, Avg Age, NPS).
2.  **Create the "Locked" View:** Below the Financial Gauges, add a new section "Operational Efficiency."
3.  **State Management:** If the user hasn't provided data yet, this section should be blurred or covered with an overlay that says "Unlock your full Scorecard."
4.  **Input Form:** Inside the overlay, provide a form with 5 inputs corresponding to the 5 Operational KPIs.
5.  **Test:** Verify that the inputs work, but the gauges underneath are hidden/blurred.
Prompt 5: Wiring the "Unlock" & Final Integration
Markdown
Let's wire it all together.

1.  **Handle Submission:** When the user fills out the 5 inputs and clicks "Unlock":
    * Save their inputs to the component state.
    * Remove the overlay/blur.
2.  **Display Operational Gauges:** Render 5 new `GaugeChart` components in the now-visible section.
3.  **Compare:** Map the user's input to the `value` prop and use the data from `operationalBenchmarks.json` for the `average` prop.
4.  **Final Polish:** Add a "Header" with the selected Bank's name and a "Reset" button to search for a new bank.
5.  **Test:** Run through the full flow: Search Bank -> See Financials -> Enter Private Data -> See Full Benchmark.
A Note on Testing
Between each prompt, use the "Preview" browser in Antigravity to verify the logic.

Test 1: Does "Bank of America" return a search result? (Prompt 1)

Test 2: Do the financial numbers look realistic (e.g., Efficiency Ratio around 60%, not 6000%)? (Prompt 2)

Test 3: Does the Gauge needle point to the right spot? (Prompt 3)