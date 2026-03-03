import { test, expect } from '@playwright/test';
import path from 'path';
import os from 'os';

/**
 * PDF Export Feature Tests
 * Verifies the "Export PDF" button is visible, functional, and produces
 * a non-empty downloaded file.
 */

async function loadJPMorgan(page) {
    // Inject auth state to bypass LinkedIn login walls
    await page.goto('/');
    await page.evaluate(() => {
        localStorage.setItem('feat_auth_required', 'false');
        localStorage.setItem('auth_user', JSON.stringify({
            name: 'Playwright Test User',
            email: 'test@example.com',
            sub: 'playwright|123456'
        }));
    });
    // Reload so the bundle re-evaluates localStorage.getItem('feat_auth_required')
    await page.reload();
    await page.waitForLoadState('networkidle');

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

test.describe('PDF Export', () => {

    test('PDF button triggers a file download that is not blank', async ({ page }) => {
        test.setTimeout(120000); // PDF generation might take longer, give it 2 minutes
        await loadJPMorgan(page);

        // Find the "Export PDF" button. It should be visible.
        const pdfBtn = page.locator('button[title="Export PDF"]');
        await expect(pdfBtn).toBeVisible({ timeout: 10000 });

        // Intercept the download event
        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 60000 }),
            pdfBtn.click(),
        ]);

        // Verify the download was triggered and has a .pdf filename
        const filename = download.suggestedFilename();
        expect(filename, 'Download filename must end with .pdf').toMatch(/\.pdf$/i);
        expect(filename, 'Filename should contain BankValue_').toMatch(/BankValue_/i);

        // Save to temp dir and read the content size
        const tmpPath = path.join(os.tmpdir(), filename);
        await download.saveAs(tmpPath);

        const fs = await import('fs');
        const stats = fs.statSync(tmpPath);

        // A blank 1-page PDF is roughly 1-2KB. A multi-page PDF with charts should be at least 50KB.
        // If it's totally blank, it would be very small.
        expect(stats.size).toBeGreaterThan(50000); // Expect greater than 50KB
        console.log(`Downloaded PDF size: ${stats.size} bytes`);
    });

});
