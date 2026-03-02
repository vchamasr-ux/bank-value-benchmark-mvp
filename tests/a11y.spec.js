import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility baseline — enforces WCAG 2.1 AA at the critical/serious level.
 *
 * Philosophy: We DO NOT suppress real accessibility bugs. We DO distinguish between
 * a structural violation (critical/serious — must fix) and a decorative nuance
 * (minor/moderate — tracked but does not block premium UI polish).
 *
 * The authoritative "full vibe" a11y suite lives in a11y-polish.spec.js.
 */

// Helper: build a readable failure message from axe violations
function buildViolationMessage(violations) {
    return violations
        .map(v =>
            `[${v.impact.toUpperCase()}] ${v.id}: ${v.description}\n` +
            v.nodes.map(n => `  → ${n.target}  |  ${n.failureSummary}`).join('\n')
        )
        .join('\n\n');
}

test.describe('Accessibility Checks (Axe-core)', () => {

    test('Landing Page has zero critical or serious accessibility violations', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#bank-search-input', { timeout: 15000 });
        await page.waitForTimeout(500);

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
            .analyze();

        // Only block the build on critical/serious impact — minor/moderate Polish
        // issues (decorative text, placeholder contrast) are caught separately.
        const blocking = results.violations.filter(
            v => v.impact === 'critical' || v.impact === 'serious'
        );

        if (blocking.length > 0) {
            throw new Error(
                `Landing Page has ${blocking.length} critical/serious a11y violation(s):\n\n` +
                buildViolationMessage(blocking)
            );
        }

        expect(blocking.length, 'Critical/serious a11y violations on Landing Page').toBe(0);
    });

    test('Pitchbook App (De Novo Modeler) has zero critical or serious accessibility violations', async ({ page }) => {
        await page.goto('/?b=123');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze();

        const blocking = results.violations.filter(
            v => v.impact === 'critical' || v.impact === 'serious'
        );

        if (blocking.length > 0) {
            throw new Error(
                `Pitchbook App has ${blocking.length} critical/serious a11y violation(s):\n\n` +
                buildViolationMessage(blocking)
            );
        }

        expect(blocking.length, 'Critical/serious a11y violations on Pitchbook').toBe(0);
    });

});
