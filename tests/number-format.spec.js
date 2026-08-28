import { test, expect } from '@playwright/test';

// Class 1 Guard: Number Formatting
// Catches ANY component that renders a raw float with more than 2 decimal places.
// Run this any time a new KPI component is added to ensure it uses .toFixed() correctly.

// ─── Helper: Load bank dashboard via UI search ────────────────────────────────
// Using UI navigation instead of deprecated ?acq= query params — ensures the
// full React app state (selectedBank, cert, etc.) is set correctly via normal
// user flow before we scan the rendered text.
async function loadDashboard(page) {
    await page.goto('/');
    const searchInput = page.locator('#bank-search-input');
    await expect(searchInput).toBeVisible({ timeout: 15000 });
    await searchInput.fill('JPMorgan Chase');

    const firstResult = page.locator('li').filter({ hasText: /JPMorgan/i }).first();
    await expect(firstResult).toBeVisible({ timeout: 10000 });
    await firstResult.click();

    // Wait for the key gauge to confirm data has loaded
    await page.waitForSelector('text=Efficiency Ratio', { timeout: 20000 });
}

test.describe('Number Formatting Guard', () => {

    test('No KPI value should render with more than 2 decimal places', async ({ page }) => {
        await loadDashboard(page);

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
        await loadDashboard(page);

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
