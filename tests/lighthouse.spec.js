import { test, chromium } from '@playwright/test';
import { playAudit } from 'playwright-lighthouse';

test.describe('Lighthouse Optimizations', () => {
    // Increase timeout for Lighthouse audits
    test.setTimeout(180000);

    test('should pass Lighthouse performance and SEO audits', async () => {
        // Lighthouse requires remote-debugging-port to be open
        const browser = await chromium.launch({
            args: ['--remote-debugging-port=9222'],
        });
        const context = await browser.newContext();
        const page = await context.newPage();

        // Use port 4174 to avoid conflicts with other preview servers
        const targetUrl = process.env.TEST_URL || 'http://localhost:4174';

        // Go to the page and wait for everything to settle
        await page.goto(targetUrl, { waitUntil: 'networkidle' });

        // Let React finish any suspense rendering before starting the audit
        await page.waitForTimeout(5000);

        // Run Lighthouse audit
        await playAudit({
            page,
            port: 9222,
            url: targetUrl, // explicitly pass URL
            thresholds: {
                performance: 70, // Target minimum Performance score
                seo: 90,         // Target minimum SEO score
            },
            opts: {
                // Keep the page layout and state
                disableStorageReset: true,
            },
            // You can generate reports conditionally if you want:
            reports: {
                formats: {
                    html: true,
                },
                name: 'lighthouse-report',
                directory: `${process.cwd()}/lighthouse-report`,
            },
        });

        await context.close();
        await browser.close();
    });
});
