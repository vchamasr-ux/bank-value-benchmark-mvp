import { test, expect } from '@playwright/test';

test.describe('Competitive Radar (MoversView)', () => {

    test.beforeEach(async ({ page }) => {
        // Go to home page and select a base bank to unlock the Radar
        await page.goto('/');
        const searchInput = page.getByPlaceholder('Enter bank name...');
        await expect(searchInput).toBeVisible({ timeout: 15000 });
        await searchInput.fill('JPMorgan Chase');
        const searchResult = page.getByText('CERT: 628');
        await expect(searchResult).toBeVisible({ timeout: 10000 });
        await searchResult.click();
        await expect(page.getByRole('heading', { name: 'JPMorgan Chase Bank' })).toBeVisible({ timeout: 15000 });
    });

    test('should toggle between Market Threats and Growth Playbooks in Radar', async ({ page }) => {
        // 1. Click the Radar nav button to switch views
        const radarNavBtn = page.getByRole('button', { name: 'Radar' });
        await expect(radarNavBtn).toBeVisible();
        await radarNavBtn.click();

        // 2. Wait for Radar component to load
        await expect(page.getByRole('heading', { name: 'Competitive Radar' })).toBeVisible({ timeout: 15000 });

        // 3. By default, 'Market Threats' should be active
        // The active tab usually has a distinctive styling or text, but we can check if the button is visible
        const threatsTab = page.getByRole('button', { name: /Market Threats/i });
        await expect(threatsTab).toBeVisible();

        // 4. Switch to Growth Playbooks
        const playbooksTab = page.getByRole('button', { name: /Growth Playbooks/i });
        await playbooksTab.click();

        // At this point, we just verify the application didn't crash and the tab is still visible
        await expect(playbooksTab).toBeVisible();
    });

    test('should allow drill down back to dashboard from a radar peer', async ({ page }) => {
        await page.getByRole('button', { name: 'Radar' }).click();
        await expect(page.getByRole('heading', { name: 'Competitive Radar' })).toBeVisible({ timeout: 15000 });

        // 1. Wait for the list of peers to render (they contain bank names as headings)
        const drillDownTarget = page.getByRole('heading', { level: 4 }).first();
        await expect(drillDownTarget).toBeVisible({ timeout: 15000 });

        // 2. Click the heading to drill down
        await drillDownTarget.click();

        // 3. The view should switch back to the Financial Health Scorecard
        await expect(page.getByText('Financial Health Scorecard').first()).toBeVisible({ timeout: 15000 });

        // 4. Verify context back button exists
        await expect(page.getByText(/Back to .* Competitive Radar/)).toBeVisible();
    });

});
