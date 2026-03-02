import { test, expect } from '@playwright/test';

// Define the viewports we want to ensure stay visually perfect
const viewports = [
    { name: 'Desktop', width: 1280, height: 720 },
    { name: 'Mobile', width: 375, height: 667 }, // iPhone SE dimensions
];

for (const vp of viewports) {
    test.describe(`Visual Regression Baseline Comparisons - ${vp.name}`, () => {

        test.use({ viewport: { width: vp.width, height: vp.height } });

        test('Landing Page Baseline', async ({ page }) => {
            await page.goto('/');

            // Wait for the UI to be fully interactive/rendered
            await page.waitForLoadState('networkidle');

            // Take a full page screenshot.
            await expect(page).toHaveScreenshot(`landing-page-baseline-${vp.name.toLowerCase()}.png`, {
                fullPage: true,
                maxDiffPixels: 100,
                animations: "disabled" // 2026 UI Polish Standard
            });
        });

        test('Pitchbook App (De Novo Modeler) Baseline', async ({ page }) => {
            // Navigate with a query param that loads the pitchbook view
            await page.goto('/?b=123');

            // Wait for network requests to settle (e.g. data fetching for charts)
            await page.waitForLoadState('networkidle');

            // Give Recharts / SVG animations a moment to draw
            await page.waitForTimeout(1500);

            // Take a screenshot of the viewport
            await expect(page).toHaveScreenshot(`pitchbook-app-baseline-${vp.name.toLowerCase()}.png`, {
                fullPage: true,
                maxDiffPixels: 150,
                animations: "disabled"
            });
        });

        test('Financial Dashboard Baseline', async ({ page }) => {
            // Set auth AND disable the auth gate BEFORE the JS module reads it at load time
            await page.goto('/');
            await page.evaluate(() => {
                localStorage.setItem('feat_auth_required', 'false'); // disables FEAT_AUTH_REQUIRED
                localStorage.setItem('auth_user', JSON.stringify({
                    sub: 'visual-test-user',
                    name: 'Visual Test User',
                    email: 'visual@bankvalue.com',
                    profileUrl: 'https://linkedin.com/in/visualtest'
                }));
            });
            // Reload so the bundle re-evaluates localStorage.getItem('feat_auth_required')
            await page.reload();
            await page.waitForLoadState('networkidle');

            // Navigate to a known large bank (JPMorgan) which has all data fields populated
            await page.goto('/?acq=628&tgt=3510');

            // Wait for the Financial Health Scorecard to appear (indicates data loaded)
            await page.waitForSelector('text=Financial Health Scorecard', { timeout: 30000 });
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000); // Extra time for charts/gauges to animate in

            // Mask dynamic timestamps to avoid flaky snapshot diffs
            await expect(page).toHaveScreenshot(`financial-dashboard-baseline-${vp.name.toLowerCase()}.png`, {
                fullPage: true,
                maxDiffPixels: 200,
                animations: "disabled",
                mask: [
                    page.locator('text=As of Q').first() // Mask dynamic quarter text
                ]
            });
        });

    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-Slide Pitchbook Visual Regression (Desktop only — these are fixed 16:9)
// Catches: blank slides, overflowing content, broken layouts inside any slide.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Pitchbook Slide-by-Slide Visual Regression', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    // Only run if PLAYWRIGHT_TEST_BASE_URL is set (Vercel staging or local dev with ?acq=... working)
    test('All 10 slides render without overflow or blank content', async ({ page }) => {
        // Open pitchbook for JPMorgan Chase
        await page.goto('/?acq=628&tgt=3510');
        await page.waitForSelector('text=Efficiency Ratio', { timeout: 20000 });

        // Open the pitchbook presentation
        const presentLiveBtn = page.getByRole('button', { name: /Present Live/i }).first();
        await presentLiveBtn.click();
        await page.waitForSelector('text=Close Presentation', { timeout: 5000 });
        await page.waitForTimeout(800); // let the first slide animate in

        const TOTAL_SLIDES = 10;

        for (let i = 1; i <= TOTAL_SLIDES; i++) {
            // Wait for slide animation to complete
            await page.waitForTimeout(600);

            // Assert the slide has visible text content (not blank)
            const slideText = await page.evaluate(() => {
                const canvas = document.querySelector('.pitchbook-canvas');
                return canvas ? canvas.innerText.trim() : '';
            });
            expect(slideText.length, `Slide ${i} appears blank`).toBeGreaterThan(10);

            // Assert no horizontal scroll within the slide canvas
            const canvasOverflow = await page.evaluate(() => {
                const canvas = document.querySelector('.pitchbook-canvas');
                if (!canvas) return false;
                return canvas.scrollWidth > canvas.clientWidth;
            });
            expect(canvasOverflow, `Slide ${i} has horizontal overflow`).toBe(false);

            // Capture a baseline screenshot for this slide
            await expect(page).toHaveScreenshot(`pitchbook-slide-${String(i).padStart(2, '0')}-desktop.png`, {
                maxDiffPixels: 200,
                animations: "disabled",
                mask: [
                    page.locator('.recharts-surface') // Recharts can occasionally render paths slightly differently; mask them out entirely for pure slide layout testing if desired, or leave them if SVG pixel-matching is solid.
                ],
                clip: await page.locator('.pitchbook-canvas').boundingBox()
            });

            // Navigate to next slide (skip on last)
            if (i < TOTAL_SLIDES) {
                await page.keyboard.press('ArrowRight');
            }
        }
    });
});
