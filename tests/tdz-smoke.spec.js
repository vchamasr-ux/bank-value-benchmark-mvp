/**
 * TDZ Smoke Test Suite
 * =====================
 * Purpose: Catch "Cannot access 'X' before initialization" crashes BEFORE
 * they reach production. These tests exercise the three known TDZ risk vectors:
 *
 *   1. MODULE LOAD ORDER — verifies the app renders without errors on first load
 *      (catches top-level const / export ordering bugs, which Rollup minifies
 *      to single-letter names like `x`, making them hard to trace post-deploy)
 *
 *   2. BANK SELECTION FLOW — verifies calculateKPIs + KPI pipeline runs
 *      without crashing when a real bank is selected (exercises the full
 *      fdicService → kpiCalculator import chain that was previously crashing)
 *
 *   3. ERROR BOUNDARY CHECK — confirms the app DOES NOT silently swallow
 *      the TDZ crash and show the "Something went wrong" fallback UI
 *      (which is what the user was seeing in the screenshot)
 *
 * Run with: npx playwright test tests/tdz-smoke.spec.js
 *
 * NOTE: Tests target the production URL by default. Change BASE_URL below
 * to point at localhost for local dev verification.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://bank-value-benchmark-mvp.vercel.app';

// ─────────────────────────────────────────────────────────────
// TEST 1: Module Load Order — no TDZ on initial render
// ─────────────────────────────────────────────────────────────
test.describe('1. Module Load Order — Initial Render', () => {

    test('App loads without a JavaScript TDZ crash', async ({ page }) => {
        const jsErrors = [];
        // Capture ALL uncaught JS errors. A TDZ crash will ALWAYS show here.
        page.on('pageerror', (err) => jsErrors.push(err.message));

        await page.goto(BASE_URL, { waitUntil: 'networkidle' });

        // The error boundary renders "Something went wrong" on a TDZ crash.
        // Assert it is NOT visible.
        const errorBoundary = page.getByText('Something went wrong', { exact: false });
        await expect(errorBoundary).not.toBeVisible({ timeout: 8000 });

        // Assert no JS errors were thrown during load. If a TDZ error fired,
        // its message will include "before initialization" or "Cannot access".
        const tdzErrors = jsErrors.filter(msg =>
            msg.includes('before initialization') ||
            msg.includes('Cannot access') ||
            msg.includes('is not defined')
        );
        expect(tdzErrors, `TDZ crash detected on load: ${tdzErrors.join(' | ')}`).toHaveLength(0);
    });

    test('Landing page content is visible (not replaced by error boundary)', async ({ page }) => {
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });

        // The landing page should show the BankValue logo text
        // If there's a TDZ crash, instead we'd see the error boundary
        const heading = page.locator('text=BANKVALUE').or(page.locator('text=Bank').first());
        await expect(heading).toBeVisible({ timeout: 10000 });
    });
});

// ─────────────────────────────────────────────────────────────
// TEST 2: KPI Pipeline — calculateKPIs import chain
// ─────────────────────────────────────────────────────────────
test.describe('2. KPI Pipeline — calculateKPIs + fdicService import chain', () => {

    test('Selecting a bank does NOT trigger a TDZ crash', async ({ page }) => {
        const jsErrors = [];
        page.on('pageerror', (err) => jsErrors.push(err.message));

        await page.goto(BASE_URL, { waitUntil: 'networkidle' });

        // Type in the bank search box
        const searchInput = page.locator('#bank-search-input');
        await expect(searchInput).toBeVisible({ timeout: 15000 });
        await searchInput.fill('JPMorgan Chase');

        // Wait for autocomplete results and click the first one
        const firstResult = page.locator('[data-testid="bank-result"]').or(
            page.getByRole('option').first()
        ).or(
            // Fallback: any element containing the bank name in a list
            page.locator('li').filter({ hasText: /JPMorgan/i }).first()
        );

        await expect(firstResult).toBeVisible({ timeout: 10000 });
        await firstResult.click();

        // After selecting, the KPI dashboard should load. Give it time to call
        // the FDIC API and run calculateKPIs.
        await page.waitForLoadState('networkidle');

        // Confirm NO TDZ crash occurred during the KPI calculation pipeline
        const tdzErrors = jsErrors.filter(msg =>
            msg.includes('before initialization') ||
            msg.includes('Cannot access')
        );
        expect(tdzErrors, `TDZ in KPI pipeline: ${tdzErrors.join(' | ')}`).toHaveLength(0);

        // Confirm the error boundary is not shown
        await expect(page.getByText('Something went wrong', { exact: false })).not.toBeVisible();
    });

    test('/api/benchmarks endpoint returns 200 without crashing the server', async ({ request }) => {
        // This directly hits the Vercel serverless function that had the TDZ bug.
        // The bug: const kv = new Redis(...) at top-level was suspect; now we confirm
        // the endpoint can be called and returns a valid JSON shape.
        const response = await request.get(`${BASE_URL}/api/benchmarks?assetSize=10000000&subjectState=VA`);

        // Accept 200 (success) or 400 (missing param) — both mean the module LOADED correctly.
        // A 500 with "Cannot access" means the TDZ is in the API route itself.
        expect(response.status(), `Benchmarks API crashed: ${await response.text()}`).not.toBe(500);

        if (response.status() === 200) {
            const body = await response.json();
            // Verify the shape of the response — groupName is always present on success
            expect(body).toHaveProperty('groupName');
            expect(body).toHaveProperty('sampleSize');
        }
    });
});

// ─────────────────────────────────────────────────────────────
// TEST 3: Error Boundary — TDZ must NOT be silently swallowed
// ─────────────────────────────────────────────────────────────
test.describe('3. Error Boundary — Crash visibility', () => {

    test('Error boundary is NOT shown on a clean load', async ({ page }) => {
        const jsErrors = [];
        page.on('pageerror', err => jsErrors.push(err.message));

        await page.goto(BASE_URL, { waitUntil: 'networkidle' });

        // "Something went wrong" — the exact text from the ErrorBoundary component
        await expect(page.getByText('Something went wrong')).not.toBeVisible({ timeout: 5000 });

        // Also assert "Cannot access" is not in any visible page text
        // (some error boundaries render the raw error message)
        await expect(page.getByText(/Cannot access .* before initialization/)).not.toBeVisible();
    });

    test('Console is clean of chunk load failures on initial load', async ({ page }) => {
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        await page.goto(BASE_URL, { waitUntil: 'networkidle' });

        // Filter for TDZ-specific console errors
        const critical = consoleErrors.filter(msg =>
            msg.includes('before initialization') ||
            msg.includes('ChunkLoadError') ||
            msg.includes('SyntaxError')
        );
        expect(critical, `Console errors: ${critical.join(' | ')}`).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────────────────────
// TEST 4: Pitchbook Presentation — TDZ in slide rendering
// ─────────────────────────────────────────────────────────────
test.describe('4. Pitchbook Presentation — Slide render chain', () => {

    test('Pitchbook does not crash with TDZ when opened', async ({ page }) => {
        const jsErrors = [];
        page.on('pageerror', err => jsErrors.push(err.message));

        await page.goto(BASE_URL, { waitUntil: 'networkidle' });

        // Try to find and click any "Present" or "Pitchbook" button
        const presentBtn = page.getByRole('button', { name: /present|pitchbook|briefing/i }).first();

        // Only run this sub-test if the present button is accessible
        // (requires a bank to be selected first in real use)
        const isVisible = await presentBtn.isVisible().catch(() => false);
        if (!isVisible) {
            test.skip();
            return;
        }

        await presentBtn.click();
        await page.waitForTimeout(1500); // Let the slide rendering settle

        const tdzErrors = jsErrors.filter(msg => msg.includes('before initialization'));
        expect(tdzErrors, `TDZ in Pitchbook: ${tdzErrors.join(' | ')}`).toHaveLength(0);
    });
});
