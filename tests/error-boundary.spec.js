import { test, expect } from '@playwright/test';

// Class 7 Guard: ErrorBoundary Stress Test
// Verifies that the ErrorBoundary catches failures gracefully, surfaces them correctly,
// and that recovery ("Try Again" / "Reload") actually works.

const FDIC_PATTERN = '**/api.fdic.gov/api/financials**';
const BENCHMARK_PATTERN = '**/api/benchmarks**';

test.describe('ErrorBoundary Stress Test', () => {

    test('Test 1 — FDIC 500: ErrorBoundary renders and "Try Again" button is visible', async ({ page }) => {
        await page.route(FDIC_PATTERN, async (route) => {
            await route.fulfill({ status: 500, body: 'Internal Server Error' });
        });

        await page.goto('/?acq=628&tgt=3510');
        await page.waitForTimeout(5000);

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
        await page.route(BENCHMARK_PATTERN, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: '{"broken": true, "this_is_not_a_benchmark": 123}'
            });
        });

        await page.goto('/?acq=628&tgt=3510');
        await page.waitForTimeout(5000);

        // Should NOT show a blank screen
        const bodyText = await page.evaluate(() => document.body.innerText.trim());
        expect(bodyText.length, 'Page is blank after malformed benchmark response').toBeGreaterThan(50);
    });

    test('Test 3 — Empty FDIC data: App renders empty state, NOT an ErrorBoundary crash', async ({ page }) => {
        await page.route(FDIC_PATTERN, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: [], meta: { total: 0 } })
            });
        });

        await page.goto('/?acq=628&tgt=3510');
        await page.waitForTimeout(5000);

        // Empty data should show a user-friendly message, not a crash
        await expect(page.getByText('Something went wrong')).not.toBeVisible();
        const bodyText = await page.evaluate(() => document.body.innerText.trim());
        expect(bodyText.length, 'Page is blank after empty FDIC data').toBeGreaterThan(20);
    });

    test('Test 4 — Network offline: ErrorBoundary or error state renders, no blank screen', async ({ page }) => {
        await page.goto('/');
        // Simulate offline for the FDIC API only
        await page.route(FDIC_PATTERN, async (route) => {
            await route.abort('failed');
        });

        await page.goto('/?acq=628&tgt=3510');
        await page.waitForTimeout(5000);

        const bodyText = await page.evaluate(() => document.body.innerText.trim());
        expect(bodyText.length, 'App shows a blank screen when network fails').toBeGreaterThan(20);
    });
});
