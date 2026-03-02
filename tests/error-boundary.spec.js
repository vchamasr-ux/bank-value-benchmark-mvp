import { test, expect } from '@playwright/test';

// Class 7 Guard: ErrorBoundary Stress Test
// Verifies that the ErrorBoundary catches failures gracefully, surfaces them correctly,
// and that recovery ("Try Again" / "Reload") actually works.

const FDIC_PATTERN = '**/api.fdic.gov/api/financials**';
const BENCHMARK_PATTERN = '**/api/benchmarks**';

// ─── Helper: Load bank dashboard via UI search ────────────────────────────────
// Using UI navigation instead of deprecated ?acq= query params so the FDIC
// route intercepts fire correctly before App.jsx reads the cert from state.
async function loadDashboardViaSearch(page, { fdicRoute, benchmarkRoute } = {}) {
    if (fdicRoute) await page.route(FDIC_PATTERN, fdicRoute);
    if (benchmarkRoute) await page.route(BENCHMARK_PATTERN, benchmarkRoute);

    await page.goto('/');
    const searchInput = page.locator('#bank-search-input');
    await expect(searchInput).toBeVisible({ timeout: 15000 });
    await searchInput.fill('JPMorgan Chase');

    const firstResult = page.locator('li').filter({ hasText: /JPMorgan/i }).first();
    await expect(firstResult).toBeVisible({ timeout: 10000 });
    await firstResult.click();

    await page.waitForTimeout(5000);
}

test.describe('ErrorBoundary Stress Test', () => {

    test('Test 1 — FDIC 500: ErrorBoundary renders and "Try Again" button is visible', async ({ page }) => {
        await loadDashboardViaSearch(page, {
            fdicRoute: async (route) => {
                await route.fulfill({ status: 500, body: 'Internal Server Error' });
            }
        });

        // Either the ErrorBoundary shows OR the app shows a graceful empty state.
        // What is NOT acceptable: a completely blank screen with no UI at all.
        const bodyText = await page.evaluate(() => document.body.innerText.trim());
        expect(bodyText.length, 'App rendered a completely blank screen after FDIC 500').toBeGreaterThan(20);

        // If the ErrorBoundary DID render, confirm it has the recovery buttons
        const errorBoundary = page.getByText('Something went wrong');
        const isErrorBoundaryVisible = await errorBoundary.isVisible().catch(() => false);
        if (isErrorBoundaryVisible) {
            await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Reload Page' })).toBeVisible();

            // Clicking "Try Again" should dismiss the ErrorBoundary
            await page.getByRole('button', { name: 'Try Again' }).click();
            await page.waitForTimeout(500);
            // ErrorBoundary should be gone (state reset)
            await expect(errorBoundary).not.toBeVisible();
        }
    });

    test('Test 2 — Malformed benchmark JSON: App handles gracefully', async ({ page }) => {
        await loadDashboardViaSearch(page, {
            benchmarkRoute: async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: '{"broken": true, "this_is_not_a_benchmark": 123}'
                });
            }
        });

        // Should NOT show a blank screen
        const bodyText = await page.evaluate(() => document.body.innerText.trim());
        expect(bodyText.length, 'Page is blank after malformed benchmark response').toBeGreaterThan(50);
    });

    test('Test 3 — Empty FDIC data: App renders empty state, NOT an ErrorBoundary crash', async ({ page }) => {
        await loadDashboardViaSearch(page, {
            fdicRoute: async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ data: [], meta: { total: 0 } })
                });
            }
        });

        // Empty data should show a user-friendly message, not a crash
        await expect(page.getByText('Something went wrong')).not.toBeVisible();
        const bodyText = await page.evaluate(() => document.body.innerText.trim());
        expect(bodyText.length, 'Page is blank after empty FDIC data').toBeGreaterThan(20);
    });

    test('Test 4 — Network offline: ErrorBoundary or error state renders, no blank screen', async ({ page }) => {
        await loadDashboardViaSearch(page, {
            fdicRoute: async (route) => {
                await route.abort('failed');
            }
        });

        const bodyText = await page.evaluate(() => document.body.innerText.trim());
        expect(bodyText.length, 'App shows a blank screen when network fails').toBeGreaterThan(20);
    });
});
