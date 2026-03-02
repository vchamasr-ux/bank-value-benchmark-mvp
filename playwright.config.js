import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests', // Location of our tests
    timeout: 60 * 1000,
    expect: {
        timeout: 10000,
    },
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        // Run tests against production Vercel — /api/benchmarks is a serverless function, not available locally.
        // Override with PLAYWRIGHT_TEST_BASE_URL=<your-preview-url> to test a Vercel preview branch.
        baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'https://bank-value-benchmark-mvp.vercel.app',
        trace: 'on-first-retry',
    },
    // We don't need a dev server config block because we're running against live
});
