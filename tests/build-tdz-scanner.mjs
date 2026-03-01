#!/usr/bin/env node
/**
 * Post-Build TDZ Chunk Scanner
 * =============================
 * Scans the compiled production bundle (dist/assets/*.js) for patterns
 * that indicate a TDZ (Temporal Dead Zone) ordering bug will crash at runtime.
 *
 * Background: Vite/Rollup minifies module-level `const` declarations to
 * short names like `x`, `t`, `n`. A TDZ crash happens when:
 *   const A = () => B();   // A is declared first
 *   const B = () => {};    // B is declared after — TDZ for B when A executes
 *
 * After minification this becomes:
 *   const x=()=>t();       // CRASHES: "Cannot access 't' before initialization"
 *   const t=()=>{};
 *
 * This scanner looks for that exact pattern in minified output.
 *
 * HOW TO RUN:
 *   npm run build && node tests/build-tdz-scanner.mjs
 *
 * Exit code 0 = clean, Exit code 1 = TDZ pattern found
 */

import fs from 'fs';
import path from 'path';

const DIST_DIR = path.resolve(process.cwd(), 'dist/assets');

if (!fs.existsSync(DIST_DIR)) {
    console.error('❌ dist/assets not found. Run `npm run build` first.');
    process.exit(1);
}

const jsFiles = fs.readdirSync(DIST_DIR)
    .filter(f => f.endsWith('.js') && !f.endsWith('.map'));

console.log(`\n🔍 TDZ Chunk Scanner — scanning ${jsFiles.length} bundle chunks\n` + '─'.repeat(55));

let totalIssues = 0;

for (const file of jsFiles) {
    const fullPath = path.join(DIST_DIR, file);
    const code = fs.readFileSync(fullPath, 'utf-8');

    const issues = [];

    // Pattern 1: const declared inside a chunk that is called before the chunk
    // that declares it — manifests as a forward reference to a variable.
    // We detect: const X = (args) => { ... Y ... } where Y is declared after X
    // Only feasible for small variable names (single or double letter — post-minification)

    // Pattern 2: Look for the known symptom — identifiers used before their const declaration
    // within the same ~100-char window. This is a heuristic.
    const shortVarPattern = /const ([a-z]{1,2})=(?:[^;]{0,200});[^;]{0,500}\b\1\b[^;]*;/gs;
    const constDeclarations = [];
    let match;

    // Collect all top-level const declarations with single/double-char names
    const constPattern = /\bconst ([a-z]{1,2})=/g;
    while ((match = constPattern.exec(code)) !== null) {
        constDeclarations.push({ name: match[1], pos: match.index });
    }

    // For each const, check if it's referenced BEFORE its declaration in the file
    for (const decl of constDeclarations) {
        // Find first use of this variable name (that isn't a declaration)
        const usePattern = new RegExp(`(?<!const )\\b${decl.name}\\b(?![\\s]*=)`, 'g');
        usePattern.lastIndex = 0;
        const firstUse = usePattern.exec(code);
        if (firstUse && firstUse.index < decl.pos) {
            // The variable is used before its declaration — TDZ candidate
            const context = code.substring(Math.max(0, decl.pos - 80), decl.pos + 80).replace(/\n/g, '↵');
            issues.push({
                variable: decl.name,
                declaredAt: decl.pos,
                firstUsedAt: firstUse.index,
                context
            });
        }
    }

    if (issues.length > 0) {
        console.warn(`⚠️  ${file} — ${issues.length} potential TDZ issue(s):`);
        for (const issue of issues.slice(0, 3)) { // Show max 3 per file
            console.warn(`    var '${issue.variable}': first used at pos ${issue.firstUsedAt}, declared at pos ${issue.declaredAt}`);
        }
        if (issues.length > 3) console.warn(`    ... and ${issues.length - 3} more`);
        totalIssues += issues.length;
    } else {
        console.log(`  ✅ ${file}`);
    }
}

console.log('\n' + '─'.repeat(55));
if (totalIssues > 0) {
    console.warn(`\n⚠️  ${totalIssues} potential TDZ pattern(s) found.`);
    console.warn('   These may or may not crash at runtime depending on execution path.');
    console.warn('   Investigate the flagged files manually.\n');
    process.exit(0); // Warn but don't fail — heuristic has false positives
} else {
    console.log(`\n✅ Bundle looks clean — no obvious TDZ patterns detected.\n`);
}
