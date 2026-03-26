import { test, expect } from '@playwright/test';

// Class 7 Guard: Strict Data Integrity (Live Extraction Verification)
// This test does NOT mock data. It hits the LIVE FDIC endpoints for a known major bank
// and strictly asserts that the fields we extract are fully populated, non-null, and non-zero.
// This proves we are connecting to the correct active endpoint and our extraction mapping is valid.

const FDIC_PATTERN = '**/api.fdic.gov/banks/financials**';

test.describe('Live Data Extraction Integrity', () => {

    test('Live FDIC API correctly populates core financial metrics with non-zero, non-null values', async ({ page }) => {
        let capturedFdicResponse = null;

        // Snoop the LIVE response without blocking or mocking it
        await page.route(FDIC_PATTERN, async (route) => {
            const response = await route.fetch();
            const json = await response.json();
            capturedFdicResponse = json;
            await route.fulfill({ response });
        });

        await page.goto('/');
        
        // Search for a massive bank where zero values would be impossible
        const searchInput = page.locator('#bank-search-input');
        await expect(searchInput).toBeVisible({ timeout: 15000 });
        await searchInput.fill('JPMorgan Chase');
        
        const firstResult = page.locator('[data-testid="bank-result"]').or(page.getByRole('option').first()).or(page.locator('li').filter({ hasText: /JPMorgan/i }).first());
        await expect(firstResult).toBeVisible({ timeout: 10000 });
        await firstResult.click();

        // Wait for dashboard to fully render
        await page.waitForSelector('text=Net Interest Margin', { timeout: 20000 });

        // Assert we actually captured the live data
        expect(capturedFdicResponse, 'Failed to capture live FDIC API Data').not.toBeNull();
        expect(capturedFdicResponse.data.length).toBeGreaterThan(0);

        // Check the most recent quarter's data
        const latestRecord = capturedFdicResponse.data[0].data;

        // Core Balance Sheet items (must be heavily positive for JPM)
        const strictPositiveFields = [
            'ASSET', 'DEP', 'LNLSNET', 'EQ', 'NUMEMP'
        ];

        // Core Income Statement items (must be non-zero / non-null)
        const strictIncomeFields = [
            'INTINC', 'NONII', 'NETINC'
        ];

        for (const field of strictPositiveFields) {
            expect(latestRecord, `Live extraction of ${field} failed or is missing`).toHaveProperty(field);
            expect(latestRecord[field], `Live extraction of ${field} returned null`).not.toBeNull();
            const val = parseFloat(latestRecord[field]);
            expect(val, `Live extracted ${field} should be > 0 but was ${val}`).toBeGreaterThan(0);
        }

        for (const field of strictIncomeFields) {
            expect(latestRecord, `Live extraction of ${field} failed or is missing`).toHaveProperty(field);
            expect(latestRecord[field], `Live extraction of ${field} returned null`).not.toBeNull();
            const val = parseFloat(latestRecord[field]);
            expect(val, `Live extracted ${field} should be non-zero but was ${val}`).not.toBe(0);
            expect(Number.isNaN(val)).toBe(false);
        }
        
        // Final UI Check: Ensure the dashboard isn't rendering NaNs
        const bodyText = await page.evaluate(() => document.body.innerText);
        expect(bodyText).not.toContain('NaN');
        expect(bodyText).not.toContain('Infinity');
    });

});
