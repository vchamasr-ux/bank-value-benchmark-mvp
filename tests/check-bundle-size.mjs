import fs from 'fs';
import path from 'path';

// Allowed maximum sizes in KB
const BUDGETS = {
    js: 2000,  // Max 2MB of JS
    css: 500, // Max 500KB of CSS
};

const distAssetsPath = path.resolve(process.cwd(), 'dist', 'assets');

if (!fs.existsSync(distAssetsPath)) {
    console.error("❌ 'dist/assets' directory not found. Did you run 'npm run build'?");
    process.exit(1);
}

const files = fs.readdirSync(distAssetsPath);

let totalJSSize = 0;
let totalCSSSize = 0;

files.forEach(file => {
    const filePath = path.join(distAssetsPath, file);
    const stats = fs.statSync(filePath);
    if (file.endsWith('.js')) {
        totalJSSize += stats.size;
    } else if (file.endsWith('.css')) {
        totalCSSSize += stats.size;
    }
});

const jsSizeKB = totalJSSize / 1024;
const cssSizeKB = totalCSSSize / 1024;

console.log(`📦 Bundle Sizes:
  JS: ${jsSizeKB.toFixed(2)} KB (Budget: ${BUDGETS.js} KB)
  CSS: ${cssSizeKB.toFixed(2)} KB (Budget: ${BUDGETS.css} KB)
`);

let failed = false;

if (jsSizeKB > BUDGETS.js) {
    console.error(`🚨 JS Bundle exceeds budget by ${(jsSizeKB - BUDGETS.js).toFixed(2)} KB!`);
    failed = true;
}
if (cssSizeKB > BUDGETS.css) {
    console.error(`🚨 CSS Bundle exceeds budget by ${(cssSizeKB - BUDGETS.css).toFixed(2)} KB!`);
    failed = true;
}

if (failed) {
    process.exit(1);
} else {
    console.log('✅ Bundle sizes are within budget.');
}
