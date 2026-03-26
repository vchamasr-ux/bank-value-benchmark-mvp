import { test, expect } from '@playwright/test';

test.describe('Search Error Resilience', () => {
    test.beforeEach(async ({ page }) => {
        // Mock a globally 0-result response to ensure pure isolation
        await page.route('https://api.fdic.gov/banks/institutions/**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    meta: { total: 0 },
                    data: [] // Empty dataset
                })
            });
        });
    });

    test('Searching for an invalid or filtered bank yields a graceful empty state', async ({ page }) => {
        await page.goto('http://localhost:5173');

        // Locate search input and type an invalid bank query
        const searchInput = page.getByPlaceholder('Enter bank name...');
        await expect(searchInput).toBeVisible();
        await searchInput.fill('Standard Chartered Foreign Branch Ghetto');

        // Press the manual Search button
        const searchBtn = page.getByRole('button', { name: 'Search' });
        await searchBtn.click();

        // Wait for the empty state UI to mount instead of crashing
        const noBanksFound = page.getByText('No banks found');
        await expect(noBanksFound).toBeVisible();

        // Ensure no red error bounds occur
        const errorBoundary = page.getByText('Error — Failed to fetch banks.');
        await expect(errorBoundary).not.toBeVisible();
    });
});
