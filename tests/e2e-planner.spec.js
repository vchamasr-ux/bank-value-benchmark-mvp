import { test, expect } from '@playwright/test';

test.describe('Scenario Engine (Planner)', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        const searchInput = page.getByPlaceholder('Enter bank name...');
        await expect(searchInput).toBeVisible({ timeout: 15000 });
        await searchInput.fill('JPMorgan Chase');
        const searchResult = page.getByText('CERT: 628');
        await expect(searchResult).toBeVisible({ timeout: 10000 });
        await searchResult.click();

        await expect(page.getByRole('heading', { name: 'JPMorgan Chase Bank' })).toBeVisible({ timeout: 15000 });
    });

    test('should load the Scenario Modeler and run a rate shock', async ({ page }) => {
        // 1. Click "Planner" nav button
        await page.getByRole('button', { name: 'Planner' }).click();

        // 2. Wait for Planner tab to load
        await expect(page.getByRole('heading', { name: 'What Would It Take?' })).toBeVisible({ timeout: 15000 });

        // 3. Find the Rate Shock dropdown (contains value +0 bps initially)
        const selectBps = page.locator('select').first();
        await expect(selectBps).toBeVisible();

        // 4. Change rate shock to +100
        await selectBps.selectOption('100'); // the value inside the option is usually the number as string

        // 5. Ensure the modeled NIM is rendering
        await expect(page.getByText('Modeled')).first().toBeVisible();
    });

});
