import { test, expect } from '@playwright/test';

test.describe('UI Polish & Aesthetics', () => {
    test.describe.configure({ mode: 'serial', retries: 2 }); // Flaky on local due to API rate-limits when hitting FDIC.

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('BankSearch container utilizes modern glassmorphism and shadow tokens', async ({ page }) => {
        // Locate the main container for the BankSearch component
        const container = page.getByText('Find Your Bank').locator('..').first();
        await expect(container).toBeVisible();

        // 1. Verify Glassmorphism Theme
        const classList = await container.getAttribute('class');
        expect(classList).toContain('bg-[#1e2336]');

        // 2. Verify Border Radius
        await expect(container).toHaveCSS('border-radius', '24px');

        // 3. Verify box shadow (premium custom shadow applied)
        // We ensure it's not 'none' and there's a generous shadow length
        const shadow = await container.evaluate(el => window.getComputedStyle(el).boxShadow);
        expect(shadow).not.toBe('none');
        expect(shadow.length).toBeGreaterThan(10);
    });

    test('Interactive elements contain micro-animations', async ({ page }) => {
        const button = page.locator('form').filter({ hasText: 'Search' }).locator('button[type="submit"]');
        await expect(button).toBeVisible();

        // 1. Verify Transitions are applied with a 300ms duration (Tailwind default)
        await expect(button).toHaveCSS('transition-duration', '0.3s');

        // 2. Check for interactive hover utility classes for micro-interaction
        const classList = await button.getAttribute('class');
        console.log('ACTUAL CLASSLIST:', classList);
        expect(classList).toContain('hover:-translate-y-0.5');
        expect(classList).toContain('hover:shadow-lg');
        expect(classList).toContain('transition-all');
    });

    test('Search input has smooth focus rings', async ({ page }) => {
        const input = page.locator('input[placeholder="Enter bank name..."]');
        await expect(input).toBeVisible();

        const classList = await input.getAttribute('class');
        expect(classList).toContain('focus:shadow-[0_0_0_4px_rgba(59,130,246,0.15)]');
        expect(classList).toContain('transition-all');
        expect(classList).toContain('bg-[#0f172a]');
    });

    test('Dashboard Metric Cards utilize modern glassmorphism and shadow tokens', async ({ page }) => {
        // Search and click to enter dashboard
        await page.locator('input[placeholder="Enter bank name..."]').fill('chase');
        const firstResult = page.locator('li:has-text("chase")').first();
        await expect(firstResult).toBeVisible({ timeout: 15000 });
        await firstResult.click();

        // Wait for the Dashboard to render its cards
        const card = page.locator('.glass-panel-dark').first();
        await expect(card).toBeVisible();

        // 1. Verify Glassmorphism
        const classList = await card.getAttribute('class');
        expect(classList).toContain('glass-panel-dark');

        // 3. Verify base box shadow (custom depth shadow applied)
        const shadow = await card.evaluate(el => window.getComputedStyle(el).boxShadow);
        expect(shadow).not.toBe('none');
        expect(shadow.length).toBeGreaterThan(10);
    });

    test('Data badges utilize premium high-contrast component styling', async ({ page }) => {
        // Search and click to enter dashboard
        await page.locator('input[placeholder="Enter bank name..."]').fill('chase');
        const firstResult = page.locator('li:has-text("chase")').first();
        await expect(firstResult).toBeVisible({ timeout: 15000 });
        await firstResult.click();

        // Locate the N= size badge which should now use the badge-premium class
        const badge = page.locator('button.badge-premium').first();
        await expect(badge).toBeVisible();

        const classList = await badge.getAttribute('class');
        expect(classList).toContain('badge-premium');

        // Verify some inherent styles of the badge-premium layer component
        const bgColor = await badge.evaluate(el => window.getComputedStyle(el).backgroundColor);
        expect(bgColor).not.toBe('transparent');
        expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
    });
    test('Tooltips become visible on hover and escape parent boundaries', async ({ page }) => {
        // Search and click to enter dashboard
        await page.locator('input[placeholder="Enter bank name..."]').fill('chase');
        const firstResult = page.locator('li:has-text("chase")').first();
        await expect(firstResult).toBeVisible({ timeout: 15000 });
        await firstResult.click();

        // The info icon inside the metric card header is a tooltip trigger.
        // It has a cursor-help class from the Tooltip container.
        const tooltipTrigger = page.locator('.cursor-help').first();
        await expect(tooltipTrigger).toBeVisible();

        // The tooltip content body has z-[100] and max-w-[250px]
        const tooltipContent = tooltipTrigger.locator('.z-\\[100\\]');

        // Assert initial state is invisible
        await expect(tooltipContent).toHaveClass(/invisible/);

        // Hover the trigger
        await tooltipTrigger.hover();

        // Assert tooltip becomes visible and has high z-index
        await expect(tooltipContent).toBeVisible();
        await expect(tooltipContent).toHaveCSS('z-index', '100');

        // Assert new premium styling is applied
        const classList = await tooltipContent.locator('div').first().getAttribute('class');
        expect(classList).toContain('bg-[#0B1120]/95');
        expect(classList).toContain('backdrop-blur-md');
    });

    test('Competitive Radar panels utilize high-contrast glassmorphism', async ({ page }) => {
        // Search and click to enter dashboard
        await page.locator('input[placeholder="Enter bank name..."]').fill('chase');
        const firstResult = page.locator('li:has-text("chase")').first();
        await expect(firstResult).toBeVisible({ timeout: 15000 });
        await firstResult.click();

        // Navigate to the Radar tab
        await page.getByRole('button', { name: 'Radar' }).click();

        // Wait for the radar list to populate
        // Give it extra time since the sigma stats take a moment to compute, and API rate-limits can delay
        const radarCard = page.locator('.bg-slate-800\\/80').filter({ hasText: 'Surprise Score' }).first();
        await expect(radarCard).toBeVisible({ timeout: 25000 });

        const classList = await radarCard.getAttribute('class');
        expect(classList).toContain('bg-slate-800/80');
        expect(classList).not.toContain('bg-white');
    });
});
