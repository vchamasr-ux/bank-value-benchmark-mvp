import https from 'https';

// --- KPI CALCULATOR LOGIC (Inlined for standalone test) ---
const calculateKPIs = (data) => {
    if (!data) return null;
    const val = (key) => parseFloat(data[key]) || 0;
    const nonInterestExp = val('NONIX');
    const nonInterestInc = val('NONII');
    const interestExp = val('INTEXP') || val('EINTEXP'); // The Fix
    const netInterestIncome = val('INTINC') - interestExp;
    const totalAssets = val('ASSET');
    const totalIncome = netInterestIncome + nonInterestInc;
    const totalLoans = val('LNLSNET');
    const numEmployees = val('NUMEMP');

    let costOfFunds = 0;
    if (totalAssets > 0) costOfFunds = (interestExp / totalAssets) * 100;

    return {
        costOfFunds: costOfFunds.toFixed(2),
        // ... other fields simplified/omitted for this specific debug
        raw: data
    };
};

const calculateBenchmarks = (bankList) => {
    const allKPIs = bankList.map(bank => calculateKPIs(bank)).filter(k => k !== null);
    const results = {};
    const values = allKPIs.map(k => parseFloat(k.costOfFunds)).filter(v => !isNaN(v));
    values.sort((a, b) => a - b);

    if (values.length === 0) return { costOfFunds: { p25: 0, median: 0, p75: 0 } };

    const p25 = values[Math.floor(values.length * 0.25)];
    const median = values[Math.floor(values.length * 0.50)];
    const p75 = values[Math.floor(values.length * 0.75)];
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    results.costOfFunds = {
        p25: p25.toFixed(2),
        median: median.toFixed(2),
        p75: p75.toFixed(2),
        avg: avg.toFixed(2),
        allValues: values // Log all to see distribution
    };
    return results;
};

// --- FETCH LOGIC ---
const fields = 'ASSET,NUMEMP,INTINC,INTEXP,EINTEXP,NONII,NONIX,LNLSNET';
const url = `https://api.fdic.gov/banks/financials/?filters=ASSET:[1000000%20TO%2010000000]%20AND%20ACTIVE:1&fields=${fields}&limit=20&format=json`;

console.log('Fetching...');
https.get(url, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.data) {
                const list = json.data.map(i => i.data);
                const stats = calculateBenchmarks(list);
                console.log('Cost of Funds Stats:', JSON.stringify(stats.costOfFunds, null, 2));
            }
        } catch (e) { console.log(e); }
    });
});
