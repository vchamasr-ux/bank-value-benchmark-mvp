const qs = require('querystring');

const calcKPIs = (data) => {
    try {
        const monthStr = String(data.REPDTE || '').substring(4, 6);
        const monthsMap = { '03': 3, '06': 6, '09': 9, '12': 12 };
        const monthsElapsed = monthsMap[monthStr] ?? 12;
        const annFactor = 12 / monthsElapsed;

        const nonInterestExp = parseFloat(data.NONIX) || 0;
        const nonInterestInc = parseFloat(data.NONII) || 0;
        const interestExp = parseFloat(data.INTEXP) || parseFloat(data.EINTEXP) || 0;
        const interestExpAnn = interestExp * annFactor;
        const netInterestIncome = ((parseFloat(data.INTINC) || 0) - interestExp) * annFactor;
        const interestIncomeAnn = (parseFloat(data.INTINC) || 0) * annFactor;
        const totalAssets = parseFloat(data.ASSET) || 0;
        const totalIncome = netInterestIncome + nonInterestInc * annFactor;

        let efficiencyRatio = 0;
        if (totalIncome > 0) efficiencyRatio = (nonInterestExp / totalIncome) * 100;

        let costOfFunds = 0;
        if (totalAssets > 0) costOfFunds = (interestExpAnn / totalAssets) * 100;

        let netInterestMargin = 0;
        if (totalAssets > 0) netInterestMargin = (netInterestIncome / totalAssets) * 100;

        return { efficiencyRatio, costOfFunds, netInterestMargin, totalIncome, nonInterestExp, assets: totalAssets };
    } catch (e) {
        return null;
    }
};

async function main() {
    const filters = ["ASSET:[1000000 TO 8000000]"];
    const queryParams = {
        filters: filters.join(' AND '),
        fields: 'CERT,NAME,CITY,STALP,ASSET,REPDTE,NONIX,NONII,INTEXP,EINTEXP,INTINC,LNLSNET,NETINC,EQ,NUMEMP,DEP,NCLNLS',
        limit: 10000,
        sort_by: 'ASSET',
        sort_order: 'DESC'
    };

    const res = await fetch(`https://banks.data.fdic.gov/api/institutions?${qs.stringify(queryParams)}`);
    const json = await res.json();
    const banks = json.data.map(d => d.data);

    let candidates = [];

    for (const bank of banks) {
        const kpi = calcKPIs(bank);
        if (!kpi) continue;

        if (kpi.netInterestMargin > 2.8 && kpi.efficiencyRatio > 70 && kpi.efficiencyRatio < 100) {
            candidates.push({ bank, kpi, type: 'Inefficient Engine' });
        }
        if (kpi.efficiencyRatio < 60 && kpi.costOfFunds > 3.0 && kpi.netInterestMargin < 2.5) {
            candidates.push({ bank, kpi, type: 'Leaky Bucket' });
        }
    }

    console.log(`Found ${candidates.length} candidates.`);

    // Sort by most narrative extremes
    const inefficient = candidates.filter(c => c.type === 'Inefficient Engine').sort((a, b) => b.kpi.efficiencyRatio - a.kpi.efficiencyRatio);
    const leakyBucket = candidates.filter(c => c.type === 'Leaky Bucket').sort((a, b) => b.kpi.costOfFunds - a.kpi.costOfFunds);

    if (inefficient.length > 0) {
        const best = inefficient[0];
        console.log("\n--- The 'Great Revenue Engine, Terrible Overhead' Bank ---");
        console.log(`Name: ${best.bank.NAME} (${best.bank.CITY}, ${best.bank.STALP})`);
        console.log(`Assets: $${(best.kpi.assets / 1000).toFixed(0)}M`);
        console.log(`Efficiency Ratio: ${best.kpi.efficiencyRatio.toFixed(2)}% (Terrible!)`);
        console.log(`Net Interest Margin: ${best.kpi.netInterestMargin.toFixed(2)}% (Great!)`);
        const targetExpense = (60 / 100) * best.kpi.totalIncome;
        const amountToCut = best.kpi.nonInterestExp - targetExpense;
        console.log(`Strategic Planner: "Reduce non-interest expense by $${(amountToCut / 1000).toFixed(1)}M to hit 60% ratio."`);
    }

    if (leakyBucket.length > 0) {
        const best = leakyBucket[0];
        console.log("\n--- The 'Lean Operator, Terrible Funding' Bank ---");
        console.log(`Name: ${best.bank.NAME} (${best.bank.CITY}, ${best.bank.STALP})`);
        console.log(`Assets: $${(best.kpi.assets / 1000).toFixed(0)}M`);
        console.log(`Efficiency Ratio: ${best.kpi.efficiencyRatio.toFixed(2)}% (Great!)`);
        console.log(`Cost of Funds: ${best.kpi.costOfFunds.toFixed(2)}% (Terrible!)`);
    }
}

main().catch(console.error);
