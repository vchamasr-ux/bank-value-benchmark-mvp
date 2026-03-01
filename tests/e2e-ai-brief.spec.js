import { test, expect } from '@playwright/test';

test.describe('AI Strategic Briefs', () => {

    test.beforeEach(async ({ page }) => {
        // Bypass LinkedIn authentication requirement for E2E tests
        await page.addInitScript(() => {
            window.localStorage.setItem('feat_auth_required', 'false');
        });

        await page.goto('/');
        const searchInput = page.getByPlaceholder('Enter bank name...');
        await expect(searchInput).toBeVisible({ timeout: 15000 });
        await searchInput.fill('JPMorgan Chase');

        const searchResult = page.getByText('CERT: 628');
        await expect(searchResult).toBeVisible({ timeout: 10000 });
        await searchResult.click();

        await expect(page.getByRole('heading', { name: 'JPMorgan Chase Bank' })).toBeVisible({ timeout: 15000 });
    });

    test('should open AI Brief modal and generate a summary', async ({ page }) => {
        // 1. Navigate to Radar View
        await page.getByRole('button', { name: 'Radar' }).click();
        await expect(page.getByRole('heading', { name: 'Competitive Radar' })).toBeVisible({ timeout: 15000 });

        // 2. Click "Generate Strategic Brief" button in MoversView
        const aiSumBtn = page.getByRole('button', { name: /Generate Strategic Brief/i }).first();
        await expect(aiSumBtn).toBeVisible({ timeout: 15000 });
        await aiSumBtn.click();

        // 3. Verify modal opened
        await expect(page.getByRole('heading', { name: /Competitive Intelligence Brief/i })).toBeVisible({ timeout: 10000 });

        // 3. Wait for Ecosystem Synthesis or "Ecosystem Synthesis" to appear
        await expect(page.getByText(/Ecosystem Synthesis/i)).toBeVisible({ timeout: 45000 });

        // 5. Close modal
        // Since playright getByRole('button', { name: /Close/i }) might hit multiple
        // Let's use getByText or a more specific locator.
        const closeBtn = page.locator('.fixed').getByRole('button', { name: 'Close', exact: true }).first();
        if (await closeBtn.isVisible()) {
            await closeBtn.click();
        } else {
            // Alternative close mechanism (like an X inside absolute modal corner)
            await page.keyboard.press('Escape');
        }

        await expect(page.getByRole('heading', { name: /Competitive Intelligence Brief/i })).not.toBeVisible();
    });

});
