import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests', // Location of our tests
    timeout: 60 * 1000,
    expect: {
        timeout: 10000,
    },
    fullyParallel: false, // Turn off parallel to prevent FDIC search API rate-limits locally
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1, // Enforce single thread locally to stabilize FDIC calls
    reporter: 'html',
    use: {
        // Run tests against production Vercel — /api/benchmarks is a serverless function, not available locally.
        // Override with PLAYWRIGHT_TEST_BASE_URL=<your-preview-url> to test a Vercel preview branch.
        baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173',
        trace: 'on-first-retry',
    },
    webServer: process.env.PLAYWRIGHT_TEST_BASE_URL ? undefined : {
        command: 'npm run dev -- --port 5173',
        port: 5173,
        reuseExistingServer: !process.env.CI,
    }
});
