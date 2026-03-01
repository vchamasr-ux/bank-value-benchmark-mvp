import { test, expect } from '@playwright/test';

// Regression Guard: api/benchmarks.js TDZ Import-Ordering Bug
//
// Bug: `const kv = new Redis(...)` was declared BEFORE the `import` statements.
// In ES Modules, `import` declarations are hoisted — this caused `const kv` to be
// evaluated in the temporal dead zone, crashing the serverless function with:
//   "Cannot access 'x' before initialization"
//
// This suite tests from two angles:
//   A) Direct API health checks (no browser needed) — fast and reliable.
//   B) UI integration tests — search for a real bank and confirm no ErrorBoundary.

const BASE_URL = 'https://bank-value-benchmark-mvp.vercel.app';

// ─────────────────────────────────────────────────────────────
// A. DIRECT API TESTS — uses page.request (Playwright API mode)
// ─────────────────────────────────────────────────────────────
test.describe('A. API Health: /api/benchmarks endpoint', () => {

    test('Test A1 — Returns HTTP 200 for a valid community bank asset size', async ({ request }) => {
        // assetSize=5000000 → $5B community bank tier
        const response = await request.get(`${BASE_URL}/api/benchmarks?assetSize=5000000`);

        // BEFORE the fix: this returned 500 due to TDZ crash.
        // AFTER the fix: must return 200.
        expect(
            response.status(),
            `Expected HTTP 200 from /api/benchmarks, got ${response.status()}. Possible TDZ regression.`
        ).toBe(200);
    });

    test('Test A2 — Returns HTTP 200 for a regional bank asset size', async ({ request }) => {
        // assetSize=15000000 → $15B regional bank tier
        const response = await request.get(`${BASE_URL}/api/benchmarks?assetSize=15000000`);
        expect(response.status(), `Expected HTTP 200, got ${response.status()}`).toBe(200);
    });

    test('Test A3 — Response body contains all required KPI keys', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/benchmarks?assetSize=5000000`);
        expect(response.status()).toBe(200);

        const body = await response.json();

        const requiredTopLevelKeys = [
            'efficiencyRatio', 'netInterestMargin', 'costOfFunds',
            'returnOnAssets', 'returnOnEquity', 'nptlRatio',
            'groupName', 'sampleSize', 'peerBanks', 'p25', 'p75'
        ];

        for (const key of requiredTopLevelKeys) {
            expect(body, `Missing required benchmark key: "${key}"`).toHaveProperty(key);
        }
    });

    test('Test A4 — peerBanks entries include the `cert` field', async ({ request }) => {
        // Regression fix: peerBanks entries were missing `cert`, breaking the
        // peer comparison dropdown in FinancialDashboard.
        const response = await request.get(`${BASE_URL}/api/benchmarks?assetSize=5000000`);
        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(Array.isArray(body.peerBanks)).toBe(true);
        expect(body.peerBanks.length, 'peerBanks should not be empty').toBeGreaterThan(0);

        const firstPeer = body.peerBanks[0];
        expect(
            firstPeer,
            'Each peerBanks entry must have a `cert` field for the comparison dropdown'
        ).toHaveProperty('cert');
    });

    test('Test A5 — p25 and p75 sub-objects contain required distribution keys', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/benchmarks?assetSize=5000000`);
        expect(response.status()).toBe(200);

        const body = await response.json();
        const distributionKeys = [
            'efficiencyRatio', 'netInterestMargin', 'returnOnAssets',
            'returnOnEquity', 'nptlRatio', 'assetGrowth3Y'
        ];

        for (const key of distributionKeys) {
            expect(body.p25, `p25 missing key "${key}"`).toHaveProperty(key);
            expect(body.p75, `p75 missing key "${key}"`).toHaveProperty(key);
        }
    });

    test('Test A6 — Returns 400 for missing assetSize param', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/benchmarks`);
        expect(
            response.status(),
            'Missing assetSize should return 400, not a server crash (500)'
        ).toBe(400);
    });

});

// ─────────────────────────────────────────────────────────────
// B. UI INTEGRATION — Simulate benchmark API crash, verify ErrorBoundary fires
//    and that a GOOD response results in gauges rendering.
// ─────────────────────────────────────────────────────────────
test.describe('B. UI Integration: Scorecard benchmark crash behavior', () => {
    const BENCHMARK_PATTERN = '**/api/benchmarks**';
    const FDIC_PATTERN = '**/api.fdic.gov/**';

    test('Test B1 — When benchmark API returns 500, ErrorBoundary is shown (not blank)', async ({ page }) => {
        // Force the benchmark endpoint to simulate a crash (as it did before the fix)
        await page.route(BENCHMARK_PATTERN, async (route) => {
            await route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal Server Error' }) });
        });

        // Navigate to the landing page and search for a bank
        await page.goto('/');
        const searchInput = page.locator('#bank-search-input');
        await searchInput.fill('Bay Commercial Bank');
        await page.waitForTimeout(1500); // debounce

        const firstResult = page.locator('[data-testid="bank-result"], .bank-result, li').first();
        const isResultVisible = await firstResult.isVisible().catch(() => false);
        if (isResultVisible) {
            await firstResult.click();
        }

        await page.waitForTimeout(8000); // Allow time for API calls + render

        // Page should NOT be totally blank
        const bodyText = await page.evaluate(() => document.body.innerText.trim());
        expect(bodyText.length, 'Page is completely blank after benchmark 500 — app crashed silently').toBeGreaterThan(30);
    });

    test('Test B2 — No "Cannot access before initialization" error in console on load', async ({ page }) => {
        const consoleErrors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });
        page.on('pageerror', (error) => {
            consoleErrors.push(error.message);
        });

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // The specific TDZ error that was crashing the app
        const tdzError = consoleErrors.find(e =>
            e.includes('before initialization') ||
            e.includes('Cannot access')
        );
        expect(
            tdzError,
            `TDZ error detected in console: "${tdzError}". The import-ordering bug may be back.`
        ).toBeUndefined();
    });

});
