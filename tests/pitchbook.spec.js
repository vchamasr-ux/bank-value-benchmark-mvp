// tests/pitchbook.spec.js
import { test, expect } from '@playwright/test';

test.describe('Pitchbook Presentation', () => {

    // Test running against the live site, starting at the root to avoid Vercel SPA 404s on deep links
    test.beforeEach(async ({ page }) => {
        // Go to home page
        await page.goto('/');

        // Find the search input and type the bank name
        const searchInput = page.getByPlaceholder('Enter bank name...');
        await expect(searchInput).toBeVisible({ timeout: 15000 });
        await searchInput.fill('JPMorgan Chase Bank');

        // Wait for the debounced search results to appear and click the correct one
        const searchResult = page.getByText('CERT: 628');
        await expect(searchResult).toBeVisible({ timeout: 10000 });
        await searchResult.click();

        // Ensure the dashboard loads completely by checking for a known element
        await expect(page.getByText('Financial Health Scorecard')).toBeVisible({ timeout: 15000 });
    });

    test('successfully opens the presentation via Present Live button', async ({ page }) => {
        // The button to open the presentation is labeled "Present Live"
        const pitchbookBtn = page.getByRole('button', { name: /Present Live/i });

        // We expect the button to exist, if it's missing the test will fail here.
        await expect(pitchbookBtn).toBeVisible();
        await pitchbookBtn.click();

        // Once clicked, the pitchbook portal (fixed modal) should appear 
        // The canvas or close button should be visible
        const closeBtn = page.getByRole('button', { name: /close presentation/i });
        await expect(closeBtn).toBeVisible();

        // Expect slide 1 indicator 
        await expect(page.getByText('Slide 1 of 10')).toBeVisible();

        // Expect the first slide text content
        await expect(page.getByRole('heading', { name: /Executive Briefing/i })).toBeVisible();
    });

    test('presentation navigation and keyboard controls', async ({ page }) => {
        // Open presentation
        await page.getByRole('button', { name: /Present Live/i }).click();
        await expect(page.getByText('Slide 1 of 10')).toBeVisible();

        // Navigate to next slide via button (aria-label="Next slide")
        await page.getByRole('button', { name: /Next slide/i }).click();
        await expect(page.getByText('Slide 2 of 10')).toBeVisible();

        // Navigate via keyboard arrows
        await page.keyboard.press('ArrowRight');
        await expect(page.getByText('Slide 3 of 10')).toBeVisible();

        await page.keyboard.press('ArrowLeft');
        await expect(page.getByText('Slide 2 of 10')).toBeVisible();

        // Spacebar to advance
        await page.keyboard.press('Space');
        await expect(page.getByText('Slide 3 of 10')).toBeVisible();
    });

    test('presentation includes Save as PDF and closes properly', async ({ page }) => {
        // Open presentation
        await page.getByRole('button', { name: /Present Live/i }).click();

        // Verify Save format exists
        const pdfBtn = page.getByRole('button', { name: /Save as PDF/i });
        await expect(pdfBtn).toBeVisible();

        // Test closing the presentation
        await page.getByRole('button', { name: /close presentation/i }).click();

        // Ensure the presentation frame is no longer visible
        await expect(page.locator('.pitchbook-root')).not.toBeVisible();
    });

    test('presentation mode hides internal component headers', async ({ page }) => {
        // Open presentation
        await page.getByRole('button', { name: /Present Live/i }).click();

        // Navigate to slide 8 (Competitive Radar - Threats)
        // 1 -> 8 is 7 clicks
        for (let i = 0; i < 7; i++) {
            await page.locator('.pitchbook-root').getByRole('button', { name: /Next slide/i }).click();
        }

        await expect(page.getByText('Slide 8 of 10')).toBeVisible();

        // Verify slide title exists (first slide of the matching title to avoid strict mode violation)
        await expect(page.locator('.pitchbook-root').getByText(/Market Positioning/).first()).toBeVisible();

        // We should NOT see the internal component title "Competitive Radar" inside the slide body anymore
        // (We look specifically within the canvas area)
        await expect(page.locator('.pitchbook-canvas').getByRole('heading', { level: 2, name: 'Competitive Radar' })).not.toBeVisible();

        // Navigate to slide 10 (Scenario Planner)
        await page.locator('.pitchbook-root').getByRole('button', { name: /Next slide/i }).click(); // To slide 9
        await page.locator('.pitchbook-root').getByRole('button', { name: /Next slide/i }).click(); // To slide 10

        await expect(page.getByText('Slide 10 of 10')).toBeVisible();

        // Slide 10 has the slide title "Forward-Looking Strategy & Rate Shock"
        await expect(page.locator('.pitchbook-root').getByText(/Forward-Looking Strategy/).first()).toBeVisible();

        // We should NOT see the internal component title "What Would It Take?" inside the slide body anymore
        await expect(page.locator('.pitchbook-canvas').getByRole('heading', { level: 2, name: 'What Would It Take?', exact: true })).not.toBeVisible();
    });
});
