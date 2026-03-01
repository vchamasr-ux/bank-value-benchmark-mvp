#!/usr/bin/env node
/**
 * TDZ Module Load Diagnostic Script
 * ====================================
 * This script imports ALL the JS modules that have historically caused TDZ
 * crashes in this codebase and reports exactly which ones fail and why.
 *
 * WHY: Playwright tests run against the compiled bundle where the variable name
 * is already minified to "x". This script runs against the RAW SOURCE so the
 * error message will show the ACTUAL variable name (e.g. "calculateKPIsInternal").
 *
 * HOW TO RUN:
 *   node --experimental-vm-modules tests/tdz-diagnostic.mjs
 *
 * WHAT TO LOOK FOR:
 *   ✅ PASS — module loaded cleanly
 *   ❌ FAIL — ReferenceError: Cannot access 'FOO' before initialization
 *
 * Each failure tells you EXACTLY which file and which variable is the problem.
 */

import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import path from 'path';

const ROOT = path.resolve(process.cwd(), 'src');

const modules = [
    // Utils (pure functions — lowest risk but historically broken)
    { name: 'kpiCalculator', path: `${ROOT}/utils/kpiCalculator.js` },
    { name: 'formatUtils', path: `${ROOT}/utils/formatUtils.js` },
    { name: 'gaugeConfigs', path: `${ROOT}/utils/gaugeConfigs.js` },
    { name: 'stateMapping', path: `${ROOT}/utils/stateMapping.js` },
    { name: 'kpiSpecs', path: `${ROOT}/config/kpiSpecs.js` },

    // Services (import kpiCalculator — circular import risk)
    { name: 'fdicService', path: `${ROOT}/services/fdicService.js` },
];

let passed = 0;
let failed = 0;

console.log('\n🔍 TDZ Module Load Diagnostic\n' + '─'.repeat(45));

for (const mod of modules) {
    try {
        await import(pathToFileURL(mod.path).href);
        console.log(`  ✅ PASS  ${mod.name}`);
        passed++;
    } catch (err) {
        const isTdz =
            err.message?.includes('before initialization') ||
            err.message?.includes('Cannot access') ||
            err instanceof ReferenceError;

        console.error(`  ❌ FAIL  ${mod.name}`);
        console.error(`         Type: ${err.constructor.name}`);
        console.error(`         Msg:  ${err.message}`);
        if (isTdz) {
            console.error(`         ⚠️  THIS IS A TDZ ERROR — fix declaration order in: ${mod.path}`);
        } else {
            console.error(`         (Non-TDZ error — may be expected in Node without browser APIs)`);
        }
        failed++;
    }
}

console.log('\n' + '─'.repeat(45));
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
    console.error('\n🚨 TDZ errors detected. Fix the files marked above before deploying.\n');
    process.exit(1);
} else {
    console.log('\n✅ All modules loaded cleanly. No TDZ errors found.\n');
}
