import { test, expect } from '@playwright/test';

test.describe('Advanced Dashboard Features', () => {

    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem('feat_auth_required', 'false');
        });
    });

    test('deep linking direct to a bank dashboard should render correctly', async ({ page }) => {
        await page.goto('/benchmark/628');
        const heading = page.getByRole('heading', { name: 'JPMorgan Chase Bank' });
        await expect(heading).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('Financial Health Scorecard').first()).toBeVisible({ timeout: 10000 });
    });

    test('side-by-side peer comparison successfully renders secondary bank', async ({ page }) => {
        await page.goto('/benchmark/628');
        await expect(page.getByRole('heading', { name: 'JPMorgan Chase Bank' })).toBeVisible({ timeout: 15000 });

        const compareSelect = page.locator('select[title="Select a peer bank to compare side-by-side"]');
        await expect(compareSelect).toBeVisible({ timeout: 15000 });

        const firstPeerOption = compareSelect.locator('option').nth(1);
        await expect(firstPeerOption).toBeAttached();

        const peerValue = await firstPeerOption.getAttribute('value');
        await compareSelect.selectOption(peerValue);

        await expect(page.getByText(/Peer:/).first()).toBeVisible({ timeout: 10000 });
    });

    test('peer group details modal opens and lists peers', async ({ page }) => {
        await page.goto('/benchmark/628');
        await expect(page.getByRole('heading', { name: 'JPMorgan Chase Bank' })).toBeVisible({ timeout: 15000 });

        const peerGroupBtn = page.getByTitle('View Peer Group List');
        await expect(peerGroupBtn).toBeVisible({ timeout: 15000 });
        await peerGroupBtn.click();

        const modalHeading = page.getByRole('heading', { name: /Peer Group/i }).first();
        await expect(modalHeading).toBeVisible({ timeout: 5000 });

        const tableRows = page.locator('table tbody tr');

        // Wait for table to populate
        await expect(tableRows.first()).toBeVisible({ timeout: 10000 });
        expect(await tableRows.count()).toBeGreaterThan(0);

        await page.keyboard.press('Escape');
        await expect(modalHeading).toBeHidden();
    });

    test('PDF export button enters loading state and completes', async ({ page }) => {
        await page.goto('/benchmark/628');
        await expect(page.getByRole('heading', { name: 'JPMorgan Chase Bank' })).toBeVisible({ timeout: 15000 });

        const pdfBtn = page.getByTitle('Export PDF');
        await expect(pdfBtn).toBeVisible({ timeout: 15000 });
        await pdfBtn.click();

        await expect(pdfBtn).toBeDisabled();
        await expect(pdfBtn).toBeEnabled({ timeout: 30000 });
    });
});

test.describe('Mobile Responsiveness Layout', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('dashboard stacks components vertically on mobile screens', async ({ page }) => {
        await page.goto('/benchmark/628');
        await expect(page.getByRole('heading', { name: 'JPMorgan Chase Bank' })).toBeVisible({ timeout: 15000 });

        const assetGrowth = page.getByText('Asset Growth').first();
        const loanGrowth = page.getByText('Loan Growth').first();

        await expect(assetGrowth).toBeVisible();
        await expect(loanGrowth).toBeVisible();

        const box1 = await assetGrowth.boundingBox();
        const box2 = await loanGrowth.boundingBox();

        expect(box2.y).toBeGreaterThan(box1.y);
    });
});
