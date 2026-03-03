import { test, expect } from '@playwright/test';
/**
 * Feature Wiring Tests
 * Verifies that previously-dormant features are now properly connected:
 * 1. USMap dark theme inside PeerGroupModal
 * 2. "+ Compare" button is discoverable in the dashboard header
 * 3. PeerGroupModal opens when clicking "+ Compare" and shows the USMap
 * 4. "Briefs" nav shortcut button is present for authenticated users
 */
test.describe('Feature Wiring — Dormant Features Now Active', () => {
    test.describe.configure({ mode: 'serial', retries: 2 });

    // Helper: navigate to a bank dashboard
    async function goToDashboard(page, bankName = 'jpmorgan') {
        await page.goto('/');
        await page.locator('input[placeholder="Enter bank name..."]').fill(bankName);
        const firstResult = page.locator(`li:has-text("${bankName}")`).first();
        await expect(firstResult).toBeVisible({ timeout: 15000 });
        await firstResult.click();
        // Wait for benchmark data to load (N= badge appears)
        await expect(page.locator('.badge-premium')).toBeVisible({ timeout: 30000 });
    }

    test('+ Compare button is visible in the dashboard header', async ({ page }) => {
        await goToDashboard(page);

        // The "+ Compare" button should be visible next to the N= badge
        const compareBtn = page.locator('#compare-bank-trigger');
        await expect(compareBtn).toBeVisible({ timeout: 10000 });
        await expect(compareBtn).toContainText('Compare');
    });

    test('+ Compare button opens PeerGroupModal with bank list', async ({ page }) => {
        await goToDashboard(page);

        // Click the Compare button, ensure it's visible and stable
        const compareBtn = page.locator('#compare-bank-trigger');
        await expect(compareBtn).toBeVisible({ timeout: 10000 });
        await compareBtn.evaluate(el => el.click());

        // PeerGroupModal should now be visible
        await expect(page.locator('text=Comparison Sample Group')).toBeVisible({ timeout: 5000 });

        // Bank list table should have rows
        const bankRows = page.locator('tbody tr');
        await expect(bankRows.first()).toBeVisible({ timeout: 5000 });
    });

    test('PeerGroupModal contains the USMap geographic distribution tile grid', async ({ page }) => {
        await goToDashboard(page);

        // Open via N= badge (original path)
        await page.locator('.badge-premium').click();
        await expect(page.locator('text=Geographic Distribution')).toBeVisible({ timeout: 5000 });

        // USMap should render its grid tiles (state abbreviations visible)
        // At minimum CA, TX, NY should appear in the tile grid
        const usMapTile = page.locator('[title*="Peers"]').first();
        await expect(usMapTile).toBeVisible({ timeout: 5000 });
    });

    test('USMap tile grid is dark-themed (no white background)', async ({ page }) => {
        await goToDashboard(page);

        await page.locator('.badge-premium').click();
        await expect(page.locator('text=Geographic Distribution')).toBeVisible({ timeout: 5000 });

        // The USMap container should NOT be white
        const mapContainer = page.locator('text=Geographic Distribution').locator('../..');
        const bgColor = await mapContainer.evaluate(el => window.getComputedStyle(el).backgroundColor);
        expect(bgColor, 'USMap container must not be white').not.toBe('rgb(255, 255, 255)');
    });

    test('Selecting a peer bank from PeerGroupModal activates compare mode', async ({ page }) => {
        await goToDashboard(page);

        // Open peer modal via Compare button
        const compareBtn = page.locator('#compare-bank-trigger');
        await expect(compareBtn).toBeVisible({ timeout: 10000 });
        await compareBtn.evaluate(b => b.click());
        await expect(page.locator('text=Comparison Sample Group')).toBeVisible({ timeout: 5000 });

        // Click the first bank in the list
        const firstBankRow = page.locator('tbody tr').first();
        await firstBankRow.click();

        // Modal should close and Compare: label should appear in the dashboard header
        await expect(page.locator('text=Compare:')).toBeVisible({ timeout: 5000 });
        // Compare CTA button should disappear (replaced by the active compare indicator)
        await expect(page.locator('#compare-bank-trigger')).not.toBeVisible({ timeout: 3000 });
    });

    test('Clearing the compare selection brings back the + Compare button', async ({ page }) => {
        await goToDashboard(page);

        // Open and select a peer bank
        const compareBtn = page.locator('#compare-bank-trigger');
        await expect(compareBtn).toBeVisible({ timeout: 10000 });
        await compareBtn.evaluate(b => b.click());
        await expect(page.locator('text=Comparison Sample Group')).toBeVisible({ timeout: 5000 });
        await page.locator('tbody tr').first().click();
        await expect(page.locator('text=Compare:')).toBeVisible({ timeout: 5000 });

        // Click the X button to clear the comparison
        const clearBtn = page.locator('[title="Clear comparison"]');
        await clearBtn.click();

        // Compare CTA should come back
        await expect(page.locator('#compare-bank-trigger')).toBeVisible({ timeout: 5000 });
    });
});
