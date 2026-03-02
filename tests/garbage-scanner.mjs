// tests/garbage-scanner.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Directories to scan
const SCAN_DIRS = [
    path.join(ROOT_DIR, 'src'),
    path.join(ROOT_DIR, 'api')
];

// File extensions to scan
const ALLOWED_EXT = ['.js', '.jsx', '.ts', '.tsx'];

// Patterns that trigger failure
const BANNED_PATTERNS = [
    { regex: /console\.log\(/, name: 'console.log() statement' },
    { regex: /TODO:/, name: 'TODO comment' },
    { regex: /FIXME:/, name: 'FIXME comment' },
    { regex: /debugger;/, name: 'debugger statement' }
];

let failed = false;
let issuesCount = 0;

function scanFile(filePath) {
    const ext = path.extname(filePath);
    if (!ALLOWED_EXT.includes(ext)) {
        return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
        // Skip scanning the garbage-scanner file itself (though it's in tests/, not src/)
        BANNED_PATTERNS.forEach(pattern => {
            if (pattern.regex.test(line)) {
                // Ignore instances where we might legitimately have a // TODO inside eslint disables etc if needed,
                // but strict adherence to "Fail Loudly": no exceptions.
                console.error(`\x1b[31m[FAILED]\x1b[0m Garbage Code Detected: ${pattern.name}`);
                console.error(`  --> File: ${path.relative(ROOT_DIR, filePath)}`);
                console.error(`  --> Line: ${index + 1}: ${line.trim()}`);
                failed = true;
                issuesCount++;
            }
        });
    });
}

function walkDir(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else {
            scanFile(fullPath);
        }
    }
}

console.log('Running Strict Garbage Code Scanner...');

SCAN_DIRS.forEach(dir => walkDir(dir));

if (failed) {
    console.error(`\x1b[31m\nScanner completed with ${issuesCount} violation(s). Build failed.\x1b[0m`);
    process.exit(1);
} else {
    console.log('\x1b[32mScanner complete: No garbage code detected. Clean pass.\x1b[0m');
    process.exit(0);
}
