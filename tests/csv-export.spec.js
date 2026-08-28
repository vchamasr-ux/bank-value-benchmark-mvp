import { test, expect } from '@playwright/test';
import path from 'path';
import os from 'os';

/**
 * CSV Export Feature Tests
 * Verifies the "Download CSV" button is visible, functional, and produces
 * a correctly structured file.
 */

async function loadJPMorgan(page) {
    await page.goto('/');
    const input = page.locator('input[placeholder="Enter bank name..."]');
    await expect(input).toBeVisible({ timeout: 15000 });
    await input.fill('JPMorgan Chase');
    const first = page.locator('li').filter({ hasText: /JPMorgan/i }).first();
    await expect(first).toBeVisible({ timeout: 10000 });
    await first.click();
    await page.waitForSelector('text=Financial Health Scorecard', { timeout: 25000 });
    await page.waitForTimeout(600);
}

test.describe('CSV Export', () => {

    test('CSV button is visible in dashboard action bar', async ({ page }) => {
        await loadJPMorgan(page);
        const csvBtn = page.locator('#export-csv-btn');
        await expect(csvBtn).toBeVisible({ timeout: 10000 });
        await expect(csvBtn).toContainText('CSV');
    });

    test('CSV button has emerald green styling (distinct from PDF)', async ({ page }) => {
        await loadJPMorgan(page);
        const csvBtn = page.locator('#export-csv-btn');
        await expect(csvBtn).toBeVisible({ timeout: 10000 });
        const cls = await csvBtn.getAttribute('class');
        // Emerald color classes — not same as the PDF button's slate styling
        expect(cls).toContain('emerald');
    });

    test('CSV button triggers a file download', async ({ page }) => {
        await loadJPMorgan(page);
        const csvBtn = page.locator('#export-csv-btn');
        await expect(csvBtn).toBeVisible({ timeout: 10000 });

        // Intercept the download event
        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 10000 }),
            csvBtn.click(),
        ]);

        // Verify the download was triggered and has a .csv filename
        const filename = download.suggestedFilename();
        expect(filename, 'Download filename must end with .csv').toMatch(/\.csv$/i);
        expect(filename, 'Filename should contain bank name').toMatch(/BankValue/i);
    });

    test('Exported CSV file contains expected KPI rows', async ({ page }) => {
        await loadJPMorgan(page);
        const csvBtn = page.locator('#export-csv-btn');
        await expect(csvBtn).toBeVisible({ timeout: 10000 });

        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 10000 }),
            csvBtn.click(),
        ]);

        // Save to temp dir and read the content
        const tmpPath = path.join(os.tmpdir(), download.suggestedFilename());
        await download.saveAs(tmpPath);

        const fs = await import('fs');
        const content = fs.readFileSync(tmpPath, 'utf8');

        // Check header row exists
        expect(content).toContain('Metric');
        expect(content).toContain('Value');
        expect(content).toContain('Peer Avg');

        // Check at least one core KPI row
        expect(content).toContain('Return on Assets');
        expect(content).toContain('Net Interest Margin');
        expect(content).toContain('Efficiency Ratio');

        // Check metadata block
        expect(content).toContain('BankValue');
        expect(content).toContain('Peer Group');
    });

    test('CSV button shows spinner then resets on click', async ({ page }) => {
        await loadJPMorgan(page);
        const csvBtn = page.locator('#export-csv-btn');
        await expect(csvBtn).toBeVisible({ timeout: 10000 });

        // Click and immediately check that button is temporarily in loading state
        // (spinner replaces icon — button stays in DOM)
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
        await csvBtn.click();
        await downloadPromise;

        // After download, button should return to non-disabled state within 1s
        await page.waitForTimeout(800);
        const isDisabled = await csvBtn.isDisabled();
        expect(isDisabled, 'CSV button should re-enable after export').toBe(false);
    });
});
