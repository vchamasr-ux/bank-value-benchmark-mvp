const fs = require('fs');
const modelStr = fs.readFileSync('./public/models/whatwouldittake_tiered.json', 'utf8');
const model = JSON.parse(modelStr);

// Simulated JPM Financials (using typical super-regional/g-sib approximations for quick math)
const financials = {
    ASSET: 3700000000, 
    returnOnAssets: 1.15,
    costOfFunds: 2.10,
    efficiencyRatio: 62.0,
    nonInterestIncomePercent: 40.0,
    yieldOnLoans: 5.8
};

// Simulated Benchmarks (Median + Top Quartile)
const benchmarks = {
    returnOnAssets: 0.95,
    p75: { returnOnAssets: 1.45 },
    costOfFunds: 1.95,
    p25: { costOfFunds: 1.60 }
};

const targetKpi = 'returnOnAssets';
// Bank is beating median (1.15 > 0.95), so UI auto-flips to Top Quartile (1.45)
const targetVal = 1.45; 
const currentVal = financials[targetKpi];
const deltaY = targetVal - currentVal;

console.log(`\n--- V3 SCENARIO ENGINE TEST ---`);
console.log(`Bank: JPM (Estimated Assets: $3.7T)`);
console.log(`Target: ${targetKpi} (Top Quartile)`);
console.log(`Current: ${currentVal}%`);
console.log(`Goal: ${targetVal}%  |  Gap: +${deltaY.toFixed(2)} pts\n`);

const tier = model.tiers['>$250B'];
const targetModel = tier.targets[targetKpi];
const activeLevers = tier.features;

console.log("Regression Coefficients for ROA (>$250B Tier):");
activeLevers.forEach((lev, i) => console.log(`  ${lev}: ${targetModel.coef[i].toFixed(4)}`));
console.log("\nCalculating valid paths...");

const validLevers = [];
activeLevers.forEach((leverName, idx) => {
    const coef = targetModel.coef[idx];
    if (Math.abs(coef) < 0.0001) return;
    
    const requiredMove = deltaY / coef;
    const shouldBePos = ['yieldOnLoans', 'nonInterestIncomePercent'].includes(leverName);
    const shouldBeNeg = ['costOfFunds', 'efficiencyRatio', 'nptlRatio'].includes(leverName);

    if (shouldBePos && requiredMove < 0) return; // Logic fail
    if (shouldBeNeg && requiredMove > 0) return; // Logic fail

    validLevers.push({ id: leverName, coef, delta: requiredMove });
});

validLevers.sort((a, b) => Math.abs(b.coef) - Math.abs(a.coef));

console.log("\n--- GENERATED PATHS ---\n");

// Path A
if (validLevers.length > 0) {
    console.log(`PATH A (Primary Driver): Adjust ${validLevers[0].id}`);
    console.log(`  Prescribed Change: ${validLevers[0].delta > 0 ? '+' : ''}${validLevers[0].delta.toFixed(2)} pts`);
    console.log(`  Current: ${financials[validLevers[0].id].toFixed(2)}% -> Target: ${(financials[validLevers[0].id] + validLevers[0].delta).toFixed(2)}%`);
}

// Path B
if (validLevers.length > 1) {
    console.log(`\nPATH B (Secondary Driver): Adjust ${validLevers[1].id}`);
    console.log(`  Prescribed Change: ${validLevers[1].delta > 0 ? '+' : ''}${validLevers[1].delta.toFixed(2)} pts`);
}

// Combo Balanced
if (validLevers.length > 1) {
    console.log(`\nPATH C (Balanced Approach)`);
    const share = deltaY / validLevers.length;
    validLevers.forEach(lv => {
        const move = share / lv.coef;
        console.log(`  - ${lv.id}: ${move > 0 ? '+' : ''}${move.toFixed(2)} pts (Cur: ${financials[lv.id].toFixed(2)}% -> New: ${(financials[lv.id] + move).toFixed(2)}%)`);
    });
}

// Combo Aggressive
if (validLevers.length >= 2) {
    console.log(`\nPATH D (Aggressive 60/40 Split)`);
    const m1 = (deltaY * 0.6) / validLevers[0].coef;
    const m2 = (deltaY * 0.4) / validLevers[1].coef;
    console.log(`  - ${validLevers[0].id} (60%): ${m1 > 0 ? '+' : ''}${m1.toFixed(2)} pts -> New: ${(financials[validLevers[0].id] + m1).toFixed(2)}%`);
    console.log(`  - ${validLevers[1].id} (40%): ${m2 > 0 ? '+' : ''}${m2.toFixed(2)} pts -> New: ${(financials[validLevers[1].id] + m2).toFixed(2)}%`);
}
