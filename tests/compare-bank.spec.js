import { test, expect } from '@playwright/test';

test.describe('Click-to-Compare Bank Functionality', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('Clicking a bank in the Peer Group Modal enables side-by-side comparison', async ({ page }) => {
        // 1. Search and enter dashboard
        const searchInput = page.locator('input[placeholder="Enter bank name..."]');
        await expect(searchInput).toBeVisible();
        await searchInput.fill('chase');

        const firstResult = page.locator('li:has-text("chase")').first();
        await expect(firstResult).toBeVisible();
        await firstResult.click();

        // 2. Wait for Dashboard and click the N= badge to open Peer Group Modal
        const peerGroupBadge = page.locator('button.badge-premium').filter({ hasText: /N=\d+/ }).first();
        await expect(peerGroupBadge).toBeVisible({ timeout: 15000 });
        await peerGroupBadge.click();

        // 3. Wait for Peer Group Modal to open
        const modalHeader = page.getByRole('heading', { name: /Peer Group:/ });
        await expect(modalHeader).toBeVisible();

        // Wait for rows to populate
        const bankRow = page.locator('tr').filter({ hasText: /BMO|BANK OF AMERICA|WELLS FARGO|U S BANK|TD BANK|GOLDMAN SACHS/ }).first();
        await expect(bankRow).toBeVisible({ timeout: 10000 });

        // Get the name of the bank we are about to click to verify it later
        const secondaryBankName = await bankRow.locator('td').first().innerText();

        // 4. Click the row to trigger comparison
        await bankRow.click();

        // 5. Verify modal closes automatically
        await expect(modalHeader).not.toBeVisible();

        // 6. Verify the dashboard now shows the Compare tag with the selected bank name
        const compareLabelContainer = page.locator('div').filter({ hasText: /^Compare:/ }).first();
        await expect(compareLabelContainer).toBeVisible();

        const compareTarget = compareLabelContainer.locator('span').filter({ hasText: secondaryBankName }).first();
        await expect(compareTarget).toBeVisible();

        // 7. Click the 'X' button to clear the comparison
        const clearBtn = compareLabelContainer.locator('button[title="Clear comparison"]');
        await expect(clearBtn).toBeVisible();
        await clearBtn.click();

        // 8. Verify comparison is cleared
        await expect(compareLabelContainer).not.toBeVisible();
    });
});
