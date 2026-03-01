import { test, expect } from '@playwright/test';

test.describe('Search & Core Navigation', () => {

    test.beforeEach(async ({ page }) => {
        // Run tests against the root of the site
        await page.goto('/');
    });

    test('should search for a bank and navigate to its Financial Dashboard', async ({ page }) => {
        // 1. Find the search input and type the bank name
        const searchInput = page.getByPlaceholder('Enter bank name...');
        await expect(searchInput).toBeVisible({ timeout: 15000 });
        await searchInput.fill('JPMorgan Chase');

        // 2. Wait for the debounced search results to appear
        const searchResult = page.getByText('CERT: 628');
        await expect(searchResult).toBeVisible({ timeout: 10000 });

        // 3. Click the result
        await searchResult.click();

        // 4. Verify the dashboard header loads with the correct bank name
        await expect(page.getByRole('heading', { name: 'JPMorgan Chase Bank' })).toBeVisible({ timeout: 15000 });

        // 5. Verify the core gauge sections are visible
        await expect(page.getByText('Financial Health Scorecard').first()).toBeVisible();
        await expect(page.getByText('3-Year Growth Performance').first()).toBeVisible();
        await expect(page.getByText('Operational Efficiency & Margin').first()).toBeVisible();
    });

});
