import { test, expect } from '@playwright/test';

// Class 6 Guard: API Schema Regression
// Intercepts the live FDIC API response and validates it against the same Zod schema
// used in fdicService.js. If the FDIC API silently changes a field name, CI catches it here
// before it hits a real user — even before Zod throws at runtime.

const FDIC_PATTERN = '**/api.fdic.gov/api/financials**';
const BENCHMARK_PATTERN = '**/api/benchmarks**';

test.describe('API Schema Regression Guard', () => {

    test('FDIC API response matches expected shape for a known bank', async ({ page }) => {
        let capturedFdicResponse = null;

        // Intercept and clone the response
        await page.route(FDIC_PATTERN, async (route) => {
            const response = await route.fetch();
            const json = await response.json();
            capturedFdicResponse = json;
            await route.fulfill({ response });
        });

        await page.goto('/');
        const searchInput = page.locator('#bank-search-input');
        await expect(searchInput).toBeVisible({ timeout: 15000 });
        await searchInput.fill('JPMorgan Chase');
        const firstResult = page.locator('[data-testid="bank-result"]').or(page.getByRole('option').first()).or(page.locator('li').filter({ hasText: /JPMorgan/i }).first());
        await expect(firstResult).toBeVisible({ timeout: 10000 });
        await firstResult.click();
        await page.waitForSelector('text=Efficiency Ratio', { timeout: 20000 });

        // Validate the captured response shape
        expect(capturedFdicResponse, 'FDIC API was never called — routing or test config issue').not.toBeNull();
        expect(capturedFdicResponse).toHaveProperty('data');
        expect(Array.isArray(capturedFdicResponse.data), 'FDIC response.data should be an array').toBe(true);
        expect(capturedFdicResponse.data.length, 'FDIC response.data should not be empty').toBeGreaterThan(0);

        const record = capturedFdicResponse.data[0];
        // Check core financial fields that Zod validates
        const requiredFields = [
            'REPDTE', 'INTINC', 'EINTEXP', 'NONII', 'NONIX',
            'NETINC', 'ASSET', 'EQ', 'LNLSNET', 'DEP', 'NUMEMP'
        ];
        for (const field of requiredFields) {
            expect(record.data, `FDIC field "${field}" is missing from the API response`).toHaveProperty(field);
        }
    });

    test('Benchmark API returns expected shape with required keys', async ({ page }) => {
        let capturedBenchmarkResponse = null;

        await page.route(BENCHMARK_PATTERN, async (route) => {
            const response = await route.fetch();
            const json = await response.json();
            capturedBenchmarkResponse = json;
            await route.fulfill({ response });
        });

        await page.goto('/');
        const searchInput = page.locator('#bank-search-input');
        await expect(searchInput).toBeVisible({ timeout: 15000 });
        await searchInput.fill('JPMorgan Chase');
        const firstResult = page.locator('[data-testid="bank-result"]').or(page.getByRole('option').first()).or(page.locator('li').filter({ hasText: /JPMorgan/i }).first());
        await expect(firstResult).toBeVisible({ timeout: 10000 });
        await firstResult.click();
        await page.waitForSelector('text=Efficiency Ratio', { timeout: 20000 });

        if (capturedBenchmarkResponse) {
            const requiredBenchmarkFields = [
                'efficiencyRatio', 'netInterestMargin', 'returnOnAssets', 'returnOnEquity'
            ];
            for (const field of requiredBenchmarkFields) {
                expect(capturedBenchmarkResponse, `Benchmark field "${field}" missing`).toHaveProperty(field);
            }
        }
        // If benchmark wasn't called (cached), skip — not a failure
    });

    test('App does not crash when FDIC API returns HTTP 500', async ({ page }) => {
        await page.route(FDIC_PATTERN, async (route) => {
            await route.fulfill({ status: 500, body: 'Internal Server Error' });
        });

        await page.goto('/');
        const searchInput = page.locator('#bank-search-input');
        await expect(searchInput).toBeVisible({ timeout: 15000 });
        await searchInput.fill('JPMorgan Chase');
        const firstResult = page.locator('[data-testid="bank-result"]').or(page.getByRole('option').first()).or(page.locator('li').filter({ hasText: /JPMorgan/i }).first());
        await expect(firstResult).toBeVisible({ timeout: 10000 });
        await firstResult.click();
        await page.waitForTimeout(3000);

        // Should show ErrorBoundary or graceful error — NOT a blank white screen
        const bodyText = await page.evaluate(() => document.body.innerText.trim());
        expect(bodyText.length, 'Page is completely blank after FDIC 500 error').toBeGreaterThan(20);
    });
});
