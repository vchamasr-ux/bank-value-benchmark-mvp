import { test, expect } from '@playwright/test';

// Class 2 Guard: Layout Overflow / Horizontal Scroll Detection
// Catches any page where a child element forces overflow-x on the body.

// ─── Helper: load dashboard via UI search ─────────────────────────────────────
// Uses UI navigation so the full React state (selectedBank, cert, etc.) is
// set correctly — avoids the deprecated ?acq= route.
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

// ─── Helper: measure horizontal overflow ─────────────────────────────────────
async function hasHorizontalScroll(page) {
    return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
}

// ─── Suite 1: Desktop & Landing ───────────────────────────────────────────────
test('No horizontal scrollbar on: Landing Page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForTimeout(1000);
    expect(await hasHorizontalScroll(page), 'Landing Page: scrollWidth > clientWidth').toBe(false);
});

test('No horizontal scrollbar on: Dashboard (JPMorgan) at desktop 1280px', async ({ page }) => {
    await loadDashboard(page, { viewport: { width: 1280, height: 800 } });
    expect(await hasHorizontalScroll(page), 'Dashboard at 1280px: scrollWidth > clientWidth').toBe(false);
});

// ─── Suite 2: Mobile Viewport ─────────────────────────────────────────────────
test('No horizontal scrollbar at mobile viewport (375px) on Landing Page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForTimeout(1000);
    expect(await hasHorizontalScroll(page), 'Landing Page at 375px: horizontal scroll detected!').toBe(false);
});

test('No horizontal scrollbar on dashboard at mobile viewport (375px)', async ({ page }) => {
    await loadDashboard(page, { viewport: { width: 375, height: 812 } });
    expect(await hasHorizontalScroll(page), 'Dashboard at 375px: horizontal scroll detected!').toBe(false);
});

// ─── Suite 3: Dashboard Toolbar Bounds ──────────────────────────────────────
test('Financial dashboard toolbar stays within viewport bounds on mobile', async ({ page }) => {
    await loadDashboard(page, { viewport: { width: 375, height: 812 } });

    // The top controls header wrapping the title and action buttons
    const headerElement = page.locator('text=Financial Health Scorecard').locator('..').locator('..');
    const box = await headerElement.boundingBox();

    if (box) {
        const screenWidth = page.viewportSize().width;
        expect(
            box.x + box.width,
            'Dashboard toolbar right edge must not exceed viewport width'
        ).toBeLessThanOrEqual(screenWidth);
    }
});

test('Financial dashboard toolbar does not overflow at mid-range viewport (768px)', async ({ page }) => {
    await loadDashboard(page, { viewport: { width: 768, height: 1024 } });
    expect(await hasHorizontalScroll(page), 'Dashboard at 768px: horizontal scroll detected!').toBe(false);
});

// ─── Suite 4: Pitchbook Slide Canvas ─────────────────────────────────────────
test('Pitchbook slides do not overflow horizontally', async ({ page }) => {
    await loadDashboard(page, { viewport: { width: 1280, height: 800 } });

    // Open the pitchbook presentation
    const presentLiveBtn = page.getByRole('button', { name: /Present Live/i }).first();
    await expect(presentLiveBtn).toBeVisible();
    await presentLiveBtn.click();

    await page.waitForSelector('text=Close Presentation', { timeout: 8000 });
    await page.waitForTimeout(600);

    const canvasOverflow = await page.evaluate(() => {
        const canvas = document.querySelector('.pitchbook-canvas');
        if (!canvas) return false;
        return canvas.scrollWidth > canvas.clientWidth;
    });
    expect(canvasOverflow, 'Pitchbook slide canvas has horizontal overflow').toBe(false);
});
