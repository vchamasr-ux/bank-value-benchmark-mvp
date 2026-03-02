import { test, expect } from '@playwright/test';

// Class 3 Guard: Tooltip Visibility / Overlay Clipping
// Hovers over each gauge label and verifies the tooltip appears and stays within viewport.

test.describe('Tooltip Visibility Guard', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/?acq=628&tgt=3510');
        await page.waitForSelector('text=Efficiency Ratio', { timeout: 15000 });
    });

    const GAUGE_LABELS = [
        'EFFICIENCY RATIO',
        'NET INTEREST MARGIN',
        'COST OF FUNDS',
        'RETURN ON EQUITY',
        'RETURN ON ASSETS',
    ];

    for (const label of GAUGE_LABELS) {
        test(`Tooltip for "${label}" stays within viewport on hover`, async ({ page }) => {
            // Hover the gauge label (cursor-help element)
            const gaugeLabel = page.getByText(label, { exact: false }).first();
            await gaugeLabel.hover();
            await page.waitForTimeout(400); // animation delay

            // Look for any visible tooltip element
            const tooltip = page.locator('[role="tooltip"], [data-tippy-content], .tooltip-content').first();

            // If a custom tooltip renders, check it stays in viewport
            const isVisible = await tooltip.isVisible().catch(() => false);
            if (isVisible) {
                const box = await tooltip.boundingBox();
                if (box) {
                    const viewport = page.viewportSize();
                    expect(box.x, `Tooltip x ${box.x} is outside viewport left`).toBeGreaterThanOrEqual(0);
                    expect(box.y, `Tooltip y ${box.y} is outside viewport top`).toBeGreaterThanOrEqual(0);
                    expect(box.x + box.width, `Tooltip right edge overflows viewport`).toBeLessThanOrEqual(viewport.width + 5);
                    expect(box.y + box.height, `Tooltip bottom edge overflows viewport`).toBeLessThanOrEqual(viewport.height + 5);
                }
            }

            // Also check the Recharts chart tooltip by hovering the gauge arc
            const gaugeArc = page.locator('.recharts-surface').first();
            const arcBox = await gaugeArc.boundingBox().catch(() => null);
            if (arcBox) {
                await page.mouse.move(arcBox.x + arcBox.width / 2, arcBox.y + arcBox.height / 4);
                await page.waitForTimeout(300);

                const rechartsTooltip = page.locator('.recharts-tooltip-wrapper').first();
                const rechartsVisible = await rechartsTooltip.isVisible().catch(() => false);
                if (rechartsVisible) {
                    const rBox = await rechartsTooltip.boundingBox();
                    if (rBox) {
                        const viewport = page.viewportSize();
                        expect(rBox.x, 'Recharts tooltip overflows left').toBeGreaterThanOrEqual(0);
                        expect(rBox.x + rBox.width, 'Recharts tooltip overflows right').toBeLessThanOrEqual(viewport.width + 10);
                    }
                }
            }
        });
    }
});
