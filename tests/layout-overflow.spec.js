import { test, expect } from '@playwright/test';

// Class 2 Guard: Layout Overflow / Horizontal Scroll Detection
// Catches any page where a child element forces overflow-x on the body.

const ROUTES = [
    { path: '/', name: 'Landing Page' },
    { path: '/?acq=628&tgt=3510', name: 'Dashboard (JPMorgan)' },
];

for (const route of ROUTES) {
    test(`No horizontal scrollbar on: ${route.name}`, async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto(route.path);

        // Wait for the page to fully render
        await page.waitForTimeout(1500);

        const hasHorizontalScroll = await page.evaluate(() => {
            return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });

        expect(hasHorizontalScroll, `Horizontal scroll detected on ${route.path}! scrollWidth > clientWidth`).toBe(false);
    });
}

test('No horizontal scrollbar at mobile viewport (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForTimeout(1000);

    const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll, 'Horizontal scroll detected on mobile viewport!').toBe(false);
});

test('Financial dashboard tools and benchmark indicators stay within viewport bounds on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    // Inject auth AND disable the auth gate before the JS module-level variable evaluates it
    await page.goto('/');
    await page.evaluate(() => {
        localStorage.setItem('feat_auth_required', 'false'); // disables FEAT_AUTH_REQUIRED gate
        localStorage.setItem('auth_user', JSON.stringify({
            sub: 'layout-test-user',
            name: 'Layout Test User',
            email: 'layout@bankvalue.com',
            profileUrl: 'https://linkedin.com/in/layouttest'
        }));
    });
    // Reload so the bundle re-reads localStorage.getItem('feat_auth_required') at module load time
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Navigate to a known bank dashboard
    await page.goto('/?acq=628&tgt=3510');
    await page.waitForSelector('text=Financial Health Scorecard', { timeout: 25000 });
    await page.waitForTimeout(600);

    // The top controls header wrapping the title and action buttons
    const headerElement = page.locator('text=Financial Health Scorecard').locator('..').locator('..');
    const box = await headerElement.boundingBox();

    if (box) {
        const screenWidth = page.viewportSize().width;
        expect(box.x + box.width).toBeLessThanOrEqual(screenWidth);
    }
});
