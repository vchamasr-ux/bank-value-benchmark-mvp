/**
 * Landing-page-only axe diagnostic — works against preview server.
 * Writes all violations to tests/a11y-violations.json.
 */
import { test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync } from 'fs';

test('Capture landing page a11y violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
        .analyze();

    // Nav button details
    const navButtons = page.locator('nav button');
    const navCount = await navButtons.count();
    const navDetails = [];
    for (let i = 0; i < navCount; i++) {
        const text = await navButtons.nth(i).textContent();
        navDetails.push({ index: i, text: text?.trim() });
    }

    const report = {
        violationCount: results.violations.length,
        violations: results.violations.map(v => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            elements: v.nodes.map(n => ({ target: n.target, failureSummary: n.failureSummary }))
        })),
        navButtons: navDetails
    };

    writeFileSync('tests/a11y-violations.json', JSON.stringify(report, null, 2));
    console.log(`Wrote ${results.violations.length} violations to tests/a11y-violations.json`);
});
