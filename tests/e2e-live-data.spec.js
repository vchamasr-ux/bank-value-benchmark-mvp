import { test, expect } from '@playwright/test';
import { Redis } from 'ioredis';

/**
 * E2E Live Redis Pipeline Test
 * ============================
 * Doctrine: "No Mock Data". We write a record directly into the live Redis DB,
 * then prove the React UI surfaces it correctly, then tear it down. Zero mocks.
 *
 * UI Flow under test:
 *   1. Inject a fake authenticated user into localStorage (mimics LinkedIn OAuth success)
 *   2. Click the avatar button to open the profile dropdown
 *   3. Click "My Saved Briefs" to open the SavedBriefsModal
 *   4. Intercept GET /api/briefs to inject the test user's x-linkedin-sub header
 *   5. Verify the seeded bank name appears as a list row
 *   6. Click the row, verify the brief content renders in the detail pane
 *   7. Tear down: remove the seeded Redis record
 */

const TEST_USER = {
    sub: `playwright-e2e-${Date.now()}`,
    name: 'E2E Test User',
    email: 'e2e@bankvalue.com',
};

const SEEDED_BANK_NAME = 'Automated E2E Guarantee Bank';
const SEEDED_MARKDOWN = 'This brief proves the End-to-End Redis pipeline is live and parsing correctly.';

let redisClient;
let testBriefId;

test.describe('Live Redis Pipeline — Saved Briefs E2E', () => {

    test.beforeAll(async () => {
        if (!process.env.REDIS_URL) {
            return; // The skip guard below handles this cleanly
        }

        redisClient = new Redis(process.env.REDIS_URL);
        testBriefId = `brief_${Date.now()}`;

        const testBriefData = {
            id: testBriefId,
            bankName: SEEDED_BANK_NAME,
            type: 'financial_summary', // rendered via renderMarkdown(), not renderMoversPayload()
            date: new Date().toISOString(),
            data: `## Validation Hit\n\n${SEEDED_MARKDOWN}`,
        };

        await redisClient.hset(
            `briefs:${TEST_USER.sub}`,
            testBriefId,
            JSON.stringify(testBriefData)
        );
    });

    test.afterAll(async () => {
        if (redisClient) {
            await redisClient.hdel(`briefs:${TEST_USER.sub}`, testBriefId);
            await redisClient.disconnect();
        }
    });

    test.skip(!process.env.REDIS_URL, 'REDIS_URL is required to run live DB sanity checks.');

    test('Full pipeline: seed Redis → open modal via avatar → verify content renders', async ({ page }) => {

        // STEP 1: Inject a valid auth session into localStorage so UserProfileMenu renders
        await page.goto('/');
        await page.evaluate((user) => {
            localStorage.setItem('auth_user', JSON.stringify(user));
        }, TEST_USER);
        await page.reload();
        await page.waitForLoadState('networkidle');

        // STEP 2: Intercept GET /api/briefs to inject the correct x-linkedin-sub header.
        // This is the exact mechanism SavedBriefsModal uses (it reads user.sub from AuthContext).
        await page.route('**/api/briefs', async (route) => {
            if (route.request().method() !== 'GET') {
                return route.continue();
            }
            const headers = { ...route.request().headers(), 'x-linkedin-sub': TEST_USER.sub };
            await route.continue({ headers });
        });

        // STEP 3: Open the user profile dropdown by clicking the avatar button
        // The avatar button has a title attribute: "[user.name]'s Profile"
        const avatarButton = page.getByTitle(`${TEST_USER.name}'s Profile`);
        await expect(avatarButton).toBeVisible({ timeout: 10000 });
        await avatarButton.click();

        // STEP 4: Click "My Saved Briefs" in the dropdown
        const savedBriefsButton = page.getByRole('button', { name: 'My Saved Briefs' });
        await expect(savedBriefsButton).toBeVisible({ timeout: 5000 });
        await savedBriefsButton.click();

        // STEP 5: Verify the modal opened (heading "Saved Briefs" is visible)
        await expect(page.getByRole('heading', { name: 'Saved Briefs' })).toBeVisible({ timeout: 10000 });

        // STEP 6: Wait for the seeded bank row to appear (rendered as <h4> in the list)
        const briefRow = page.getByRole('heading', { name: SEEDED_BANK_NAME });
        await expect(briefRow).toBeVisible({ timeout: 10000 });

        // STEP 7: Click the brief row to open the detail pane
        // The clickable area is the parent div; clicking the h4 propagates up to it
        await briefRow.click();

        // STEP 8: Verify the markdown content renders in the detail pane
        await expect(page.getByText(SEEDED_MARKDOWN)).toBeVisible({ timeout: 8000 });

        // STEP 9: Verify the bank name appears in the detail header as well
        await expect(
            page.getByRole('heading', { name: SEEDED_BANK_NAME, level: 3 })
        ).toBeVisible();
    });
});
