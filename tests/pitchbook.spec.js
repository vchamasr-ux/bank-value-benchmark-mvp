// tests/pitchbook.spec.js
import { test, expect } from '@playwright/test';

test.describe('Pitchbook Presentation', () => {

    // Test specifically running against a known bank we expect to load properly (e.g. JPMorgan Chase Bank CERT 628)
    test.beforeEach(async ({ page }) => {
        // Navigating to the bank report page for JPMorgan Chase Bank (Cert 628) directly since our test site is live
        await page.goto('/benchmark/628');

        // Ensure the page loads completely via a known element
        await expect(page.getByText('JPMorgan Chase Bank')).toBeVisible({ timeout: 15000 });
    });

    test('successfully opens the presentation via Generate Pitchbook button', async ({ page }) => {
        // Our target button is likely labeled "Generate Pitchbook" or similar near the top
        const pitchbookBtn = page.getByRole('button', { name: /generate.*pitchbook/i });

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
        await expect(page.getByText('Executive Briefing')).toBeVisible();
    });

    test('presentation navigation and keyboard controls', async ({ page }) => {
        // Open presentation
        await page.getByRole('button', { name: /generate.*pitchbook/i }).click();
        await expect(page.getByText('Slide 1 of 10')).toBeVisible();

        // Navigate to next slide via button
        await page.getByRole('button', { name: 'Next' }).click();
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
        await page.getByRole('button', { name: /generate.*pitchbook/i }).click();

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
        await page.getByRole('button', { name: /generate.*pitchbook/i }).click();

        // Navigate to slide 8 (Competitive Radar - Threats)
        // 1 -> 8 is 7 clicks
        for (let i = 0; i < 7; i++) {
            await page.locator('.pitchbook-root').getByRole('button', { name: 'Next' }).click();
        }

        await expect(page.getByText('Slide 8 of 10')).toBeVisible();

        // Verify slide title exists
        await expect(page.locator('.pitchbook-root').getByText(/^Market Positioning/)).toBeVisible();

        // We should NOT see the internal component title "Competitive Radar" inside the slide body anymore
        // (We look specifically within the canvas area)
        await expect(page.locator('.pitchbook-canvas').getByRole('heading', { level: 2, name: 'Competitive Radar', exact: true })).not.toBeVisible();

        // Navigate to slide 10 (Scenario Planner)
        await page.locator('.pitchbook-root').getByRole('button', { name: 'Next' }).click(); // To slide 9
        await page.locator('.pitchbook-root').getByRole('button', { name: 'Next' }).click(); // To slide 10

        await expect(page.getByText('Slide 10 of 10')).toBeVisible();

        // Slide 10 has the slide title "Forward-Looking Strategy & Rate Shock"
        await expect(page.locator('.pitchbook-root').getByText(/Forward-Looking Strategy/)).toBeVisible();

        // We should NOT see the internal component title "What Would It Take?" inside the slide body anymore
        await expect(page.locator('.pitchbook-canvas').getByRole('heading', { level: 2, name: 'What Would It Take?', exact: true })).not.toBeVisible();
    });
});
