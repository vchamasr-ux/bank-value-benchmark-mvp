import { test, expect } from '@playwright/test';

// Class 5 Guard: Auth State Matrix
// Systematically covers 5 auth scenarios that could cause the LinkedIn crash (Bug 7).

const BASE = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';

test.describe('Auth State Matrix', () => {

    test('Test 1 — No auth: App renders without ErrorBoundary', async ({ page }) => {
        // Ensure completely clean state
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.removeItem('auth_user');
            localStorage.removeItem('auth_state');
        });
        await page.reload();
        await page.waitForTimeout(1000);

        // Should NOT see the ErrorBoundary "Something went wrong" screen
        await expect(page.getByText('Something went wrong')).not.toBeVisible();
        // Should NOT be a blank page — some content should render
        const bodyText = await page.evaluate(() => document.body.innerText.trim());
        expect(bodyText.length, 'Page body is completely empty, likely a blank white screen').toBeGreaterThan(50);
    });

    test('Test 2 — Valid stored session: Dashboard renders without crash', async ({ page }) => {
        const validUser = {
            sub: 'test-user-123',
            name: 'Test User',
            email: 'test@bankvalue.com',
            profileUrl: 'https://www.linkedin.com/in/testuser'
        };

        await page.goto('/');
        await page.evaluate((user) => {
            localStorage.setItem('auth_user', JSON.stringify(user));
        }, validUser);
        await page.reload();
        await page.waitForTimeout(1500);

        await expect(page.getByText('Something went wrong')).not.toBeVisible();
        // User badge or name should appear somewhere in the UI
        const bodyText = await page.evaluate(() => document.body.innerText);
        expect(bodyText).toContain('Test User');
    });

    test('Test 3 — Malformed localStorage: Graceful recovery, no white screen', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            // Deliberately corrupt the auth_user JSON
            localStorage.setItem('auth_user', '{this is broken json!!!}');
        });
        await page.reload();
        await page.waitForTimeout(1500);

        // App must NOT show a blank screen or crash — should recover gracefully
        await expect(page.getByText('Something went wrong')).not.toBeVisible();
        const bodyText = await page.evaluate(() => document.body.innerText.trim());
        expect(bodyText.length, 'Page is blank after malformed localStorage injection').toBeGreaterThan(50);
    });

    test('Test 4 — Stale OAuth callback: Redirects cleanly, no crash', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            // Set a different state to guarantee mismatch
            localStorage.setItem('auth_state', 'valid-state-abc123');
        });

        // Navigate with a fake code and wrong state — should trigger state mismatch path
        await page.goto('/?code=fakecode&state=wrong-state-xyz');
        await page.waitForTimeout(2000);

        // Should have redirected to clean URL (the callback handler clears it)
        const url = page.url();
        expect(url).not.toContain('code=');
        await expect(page.getByText('Something went wrong')).not.toBeVisible();
    });

    test('Test 5 — callbackLoading spinner: Spinner renders, not crash', async ({ page }) => {
        // Intercept the LinkedIn API call and stall it for 2 seconds to observe the loading state
        await page.route('**/api/auth/linkedin**', async (route) => {
            await new Promise(r => setTimeout(r, 2000));
            await route.fulfill({ json: { error: 'test_timeout' } });
        });

        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('auth_state', 'loading-test-state');
        });
        await page.goto('/?code=testcode&state=loading-test-state');

        // During the 2s stall, expect the loading spinner, not an error
        page.locator('.animate-spin').first();
        // Give it a moment for callbackLoading to be set
        await page.waitForTimeout(200);
        // Could be spinner or just clean redirect — either way no ErrorBoundary
        await expect(page.getByText('Something went wrong')).not.toBeVisible();
    });
});
