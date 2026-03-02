import { test, expect } from '@playwright/test';

// Class 1 Guard: Number Formatting
// Catches ANY component that renders a raw float with more than 2 decimal places.
// Run this any time a new KPI component is added to ensure it uses .toFixed() correctly.

const BANK_URL = '/?acq=628&tgt=3510'; // JPMorgan Chase

test.describe('Number Formatting Guard', () => {

    test('No KPI value should render with more than 2 decimal places', async ({ page }) => {
        await page.goto(BANK_URL);
        // Wait for gauges to load
        await page.waitForSelector('text=Efficiency Ratio', { timeout: 15000 });

        // Get all text content from the page
        const bodyText = await page.evaluate(() => document.body.innerText);

        // Regex: match any number with 3+ digits after decimal before a % or M or $ sign
        // e.g. "52.4895481637%" should trigger, "52.49%" should NOT
        const rawFloatRegex = /\d+\.\d{3,}[%$Mx]/g;
        const violations = bodyText.match(rawFloatRegex) || [];

        // Filter out known acceptable long decimals (e.g. in URLs or metadata)
        const filteredViolations = violations.filter(v => !v.includes('https') && !v.includes('cert'));

        expect(filteredViolations, `Found raw float values: ${filteredViolations.join(', ')}`).toHaveLength(0);
    });

    test('Gauge chart value display should be capped at 2 decimal places', async ({ page }) => {
        await page.goto(BANK_URL);
        await page.waitForSelector('text=Efficiency Ratio', { timeout: 15000 });

        // Find all percentage text nodes inside gauge value containers
        const gaugeValues = await page.locator('text=/%/').allTextContents();

        for (const val of gaugeValues) {
            const match = val.match(/(\d+\.\d+)%/);
            if (match) {
                const decimalPart = match[1].split('.')[1];
                expect(decimalPart.length, `Value "${val}" has too many decimals`).toBeLessThanOrEqual(2);
            }
        }
    });
});
