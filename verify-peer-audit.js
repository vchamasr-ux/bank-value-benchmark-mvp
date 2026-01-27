
// Mock fetch
const fetch = globalThis.fetch;

// COPY OF kpiCalculator.js Logic
const calculateKPIs = (data) => {
    if (!data) return null;
    const val = (key) => parseFloat(data[key]) || 0;

    const netIncome = val('NETINC');
    const totalEquity = val('EQ');
    let returnOnEquity = 0;
    if (totalEquity > 0) {
        returnOnEquity = (netIncome / totalEquity) * 100;
    }

    return {
        returnOnEquity: returnOnEquity.toFixed(2),
        raw: data
    };
};

// SIMPLIFIED getPeerGroupBenchmark Logic
const getPeerGroupBenchmark = async () => {
    // Hardcoded logic for >10B
    const assetFilter = 'ASSET:[10000000 TO *]';
    const fields = 'ASSET,NUMEMP,INTINC,INTEXP,EINTEXP,NONII,NONIX,LNLSNET,NETINC,EQ,NCLNLS,NAME,CITY,STNAME';
    const url = `https://api.fdic.gov/banks/financials/?filters=${encodeURIComponent(assetFilter)}%20AND%20ACTIVE:1&fields=${fields}&limit=20&sort_by=REPDTE&sort_order=DESC&format=json`;

    console.log(`Fetching: ${url}`);
    try {
        const response = await fetch(url);
        const json = await response.json();

        if (json.data && json.data.length > 0) {
            console.log(`Examples found: ${json.data.length}`);

            // Log raw fields of first guy
            console.log('Sample Raw Data:', json.data[0].data);

            const peerKPIs = [];
            json.data.map(item => {
                const d = item.data;
                const kpis = calculateKPIs(d);
                if (kpis) peerKPIs.push(kpis);
            });

            const getPercentile = (arr, p) => {
                if (arr.length === 0) return 0;
                const sorted = [...arr].sort((a, b) => a - b);
                const index = (p / 100) * (sorted.length - 1);
                const lower = Math.floor(index);
                const upper = Math.ceil(index);
                const weight = index - lower;
                return sorted[lower] * (1 - weight) + sorted[upper] * weight;
            };

            const values = peerKPIs.map(k => parseFloat(k['returnOnEquity'])).filter(v => !isNaN(v));
            console.log('ROE Values:', values);

            const p25 = getPercentile(values, 25).toFixed(2);
            const p75 = getPercentile(values, 75).toFixed(2);

            console.log('Calculated P25:', p25);
            console.log('Calculated P75:', p75);

            return { p25, p75 };
        }
    } catch (e) {
        console.error(e);
    }
}

getPeerGroupBenchmark();
