const fs = require('fs');
let code = fs.readFileSync('tests/ui-polish.spec.js', 'utf8');

// Fix 1: Restore the original container locator that the other agent wrote, but ensure it works
code = code.replace(
    /const container = page.locator\('\.max-w-md'\)\.filter.*?\.first\(\);/,
    "const container = page.getByText('Find Your Bank').locator('..').first();"
);
code = code.replace( // Restore bg string
    /expect\(classList\)\.toContain\('bg-white\/95'\);/,
    "expect(classList).toContain('bg-[#1e2336]');\n        expect(classList).not.toContain('bg-white');"
);
code = code.replace( // Restore border radius
    /await expect\(container\)\.toHaveCSS\('border-radius', '16px'\);/,
    "await expect(container).toHaveCSS('border-radius', '24px');"
);

// Fix 2: Button locator
code = code.replace(
    /const button = page.locator\('\.max-w-md button\[type="submit"\]'\);/,
    "const button = page.locator('button[type=\"submit\"]:has-text(\"Search\")');"
);
code = code.replace(
    /await expect\(button\)\.toHaveCSS\('transition-duration', '0\.15s'\);/,
    "await expect(button).toHaveCSS('transition-duration', '0.3s');"  // duration-300 in Tailwind is 300ms
);

fs.writeFileSync('tests/ui-polish.spec.js', code);
