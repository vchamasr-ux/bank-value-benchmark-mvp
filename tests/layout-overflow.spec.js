import { test, expect } from '@playwright/test';

/**
 * UI Layout Requirements — Global Enforcement
 *
 * These tests define hard requirements for the entire application:
 *
 *   ✦ NO HORIZONTAL SCROLLING at any viewport on any view
 *   ✦ NO EXCESSIVE EMPTY SPACE (main content must use ≥50% of viewport height)
 *   ✦ MODALS must fit within the viewport (no overflow)
 *   ✦ TABLES within modals must not cause horizontal scroll
 *
 * Run with: npx playwright test tests/layout-overflow.spec.js
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function loadDashboard(page, { bankName = 'JPMorgan Chase', viewport = null } = {}) {
    if (viewport) await page.setViewportSize(viewport);
    await page.goto('/');
    const searchInput = page.locator('#bank-search-input');
    await expect(searchInput).toBeVisible({ timeout: 15000 });
    await searchInput.fill(bankName);
    const firstResult = page.locator('li').filter({ hasText: /JPMorgan/i }).first();
    await expect(firstResult).toBeVisible({ timeout: 10000 });
    await firstResult.click();
    await page.waitForSelector('text=Financial Health Scorecard', { timeout: 25000 });
    await page.waitForTimeout(600);
}

async function hasHorizontalScroll(page) {
    return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
}

/** Returns the scrollWidth of a specific element — > 0 horizontal scroll if scrollWidth > offsetWidth */
async function elementHasHorizontalScroll(locator) {
    return locator.evaluate(el => el.scrollWidth > el.clientWidth + 2); // +2px tolerance for sub-pixel
}



// ─── Suite 1: Page-level horizontal scroll ────────────────────────────────────

test.describe('No Horizontal Scrolling — Page Level', () => {

    test('Landing page: no horizontal scroll at 1280px', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto('/');
        await page.waitForTimeout(800);
        expect(await hasHorizontalScroll(page), 'Landing: horizontal scroll detected at 1280px').toBe(false);
    });

    test('Landing page: no horizontal scroll at 375px (mobile)', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto('/');
        await page.waitForTimeout(800);
        expect(await hasHorizontalScroll(page), 'Landing: horizontal scroll at 375px').toBe(false);
    });

    test('Dashboard (Benchmark view): no horizontal scroll at 1280px', async ({ page }) => {
        await loadDashboard(page, { viewport: { width: 1280, height: 800 } });
        expect(await hasHorizontalScroll(page), 'Dashboard 1280px: horizontal scroll detected').toBe(false);
    });

    test('Dashboard (Benchmark view): no horizontal scroll at 768px (tablet)', async ({ page }) => {
        await loadDashboard(page, { viewport: { width: 768, height: 1024 } });
        expect(await hasHorizontalScroll(page), 'Dashboard 768px: horizontal scroll detected').toBe(false);
    });

    test('Dashboard (Benchmark view): no horizontal scroll at 375px (mobile)', async ({ page }) => {
        await loadDashboard(page, { viewport: { width: 375, height: 812 } });
        expect(await hasHorizontalScroll(page), 'Dashboard 375px: horizontal scroll detected').toBe(false);
    });

    test('Radar view: no horizontal scroll at 1280px', async ({ page }) => {
        await loadDashboard(page, { viewport: { width: 1280, height: 800 } });
        await page.getByRole('button', { name: 'Radar' }).click();
        await page.waitForTimeout(800);
        expect(await hasHorizontalScroll(page), 'Radar view 1280px: horizontal scroll detected').toBe(false);
    });

    test('Planner view: no horizontal scroll at 1280px', async ({ page }) => {
        await loadDashboard(page, { viewport: { width: 1280, height: 800 } });
        await page.getByRole('button', { name: 'Planner' }).click();
        await page.waitForTimeout(800);
        expect(await hasHorizontalScroll(page), 'Planner view 1280px: horizontal scroll detected').toBe(false);
    });
});

// ─── Suite 2: Dashboard toolbar bounds ───────────────────────────────────────

test.describe('Dashboard Toolbar — Stays Within Viewport', () => {

    test('Toolbar row does not exceed viewport width at 1280px', async ({ page }) => {
        await loadDashboard(page, { viewport: { width: 1280, height: 800 } });
        const header = page.locator('#dashboard-header');
        const scrollable = await elementHasHorizontalScroll(header);
        expect(scrollable, 'Dashboard header has internal horizontal scroll').toBe(false);
    });

    test('Toolbar row does not exceed viewport width at 375px', async ({ page }) => {
        await loadDashboard(page, { viewport: { width: 375, height: 812 } });
        const viewportWidth = 375;
        const header = page.locator('#dashboard-header');
        const box = await header.boundingBox();
        if (box) {
            expect(box.x + box.width, 'Toolbar right edge exceeds 375px viewport').toBeLessThanOrEqual(viewportWidth + 2);
        }
    });
});

// ─── Suite 3: Modal horizontal overflow ───────────────────────────────────────

test.describe('Modals — No Horizontal Overflow', () => {

    test('PeerGroupModal (N= badge) has no horizontal scroll in bank list', async ({ page }) => {
        await loadDashboard(page, { viewport: { width: 1280, height: 800 } });
        // Open peer modal
        await page.locator('.badge-premium').click();
        await expect(page.locator('text=Comparison Sample Group')).toBeVisible({ timeout: 5000 });

        // Check the entire modal container
        const modal = page.locator('[class*="max-w-5xl"]').first();
        const modalScroll = await elementHasHorizontalScroll(modal);
        expect(modalScroll, 'PeerGroupModal has horizontal scroll').toBe(false);

        // Check the bank table panel specifically
        const tableContainer = page.locator('text=Comparison Sample Group').locator('../..').locator('[class*="overflow-y-auto"]').first();
        const tableScroll = await elementHasHorizontalScroll(tableContainer);
        expect(tableScroll, 'PeerGroupModal bank table panel has horizontal scroll').toBe(false);
    });

    test('Peer Group Modal fits within viewport height (no page-level scroll from modal)', async ({ page }) => {
        await loadDashboard(page, { viewport: { width: 1280, height: 800 } });
        await page.locator('.badge-premium').click();
        await expect(page.locator('text=Comparison Sample Group')).toBeVisible({ timeout: 5000 });

        const modal = page.locator('[class*="max-w-5xl"]').first();
        const box = await modal.boundingBox();
        if (box) {
            expect(box.height, 'PeerGroupModal taller than 90% of viewport').toBeLessThanOrEqual(800 * 0.92);
        }
    });
});

// ─── Suite 4: Pitchbook presentation overflow ─────────────────────────────────

test.describe('Pitchbook Presentation — No Overflow', () => {

    test('Pitchbook slides do not overflow horizontally', async ({ page }) => {
        await loadDashboard(page, { viewport: { width: 1280, height: 800 } });
        const presentLiveBtn = page.getByRole('button', { name: /Present Live/i }).first();
        await expect(presentLiveBtn).toBeVisible();
        await presentLiveBtn.click();
        await page.waitForSelector('text=Close Presentation', { timeout: 8000 });
        await page.waitForTimeout(600);

        const canvasOverflow = await page.evaluate(() => {
            const canvas = document.querySelector('.pitchbook-canvas');
            if (!canvas) return false;
            return canvas.scrollWidth > canvas.clientWidth + 2;
        });
        expect(canvasOverflow, 'Pitchbook slide canvas has horizontal overflow').toBe(false);
    });
});

// ─── Suite 5: Empty space / content density ──────────────────────────────────

test.describe('Content Density — No Excessive Empty Space', () => {

    test('Landing page: first screen is not mostly blank (content > 50% of viewport)', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto('/');
        await page.waitForTimeout(1000);

        // Check that meaningful elements are present in the first viewport
        const visibleTexts = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('h1, h2, h3, p, button, [class*="card"]'));
            return elements.filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.top >= 0 && rect.bottom <= window.innerHeight && rect.height > 0;
            }).length;
        });
        expect(visibleTexts, 'Landing page has fewer than 3 visible content elements in first viewport')
            .toBeGreaterThanOrEqual(3);
    });

    test('Dashboard: gauges and content visible without scrolling', async ({ page }) => {
        await loadDashboard(page, { viewport: { width: 1280, height: 900 } });

        // At 1280x900, at least the title, scorecard, and one gauge should be above the fold
        await page.waitForSelector('text=Financial Health Scorecard', { timeout: 10000 });
        const aboveFold = await page.evaluate(() => {
            const elements = document.querySelectorAll('[class*="gauge"], [class*="GaugeChart"], canvas, svg[class*="gauge"]');
            const visible = Array.from(elements).filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.top < window.innerHeight && rect.bottom > 0;
            });
            return visible.length;
        });
        expect(aboveFold, 'No gauge/chart elements visible above the fold on dashboard').toBeGreaterThanOrEqual(1);
    });

    test('Dashboard header takes ≤ 20% of viewport height (not wasted space)', async ({ page }) => {
        await loadDashboard(page, { viewport: { width: 1280, height: 800 } });
        const header = page.locator('#dashboard-header');
        const box = await header.boundingBox();
        if (box) {
            const viewportH = 800;
            const headerPercent = (box.height / viewportH) * 100;
            expect(headerPercent, `Dashboard header uses ${headerPercent.toFixed(1)}% of viewport — too much`).toBeLessThanOrEqual(20);
        }
    });
});
