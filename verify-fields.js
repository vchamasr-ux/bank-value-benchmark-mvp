


const verifyFields = async () => {
    // JPMorgan Chase Bank, N.A. (CERT: 628) or similar big bank for robust data
    // Let's use a generic search or formatted URL
    // We'll try to fetch NETINC, EQ, LNLSNC for a known cert.
    // CERT 628 (Chase) or just use the search from fdicService pattern? 
    // Let's just hardcode a known CERT for testing or search first.

    // Using a known one from previous context or just search "Chase"
    const cert = 628;

    const fields = 'REPDTE,ASSET,NETINC,EQ,LNLSNET,NCLNLS,LNLSN,P9GLNLS';
    const url = `https://api.fdic.gov/banks/financials/?filters=CERT:${cert}&fields=${fields}&limit=1&sort_by=REPDTE&sort_order=DESC&format=json`;

    console.log(`Fetching: ${url}`);

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.data && data.data.length > 0) {
            const result = data.data[0].data;
            console.log('--- Result ---');
            console.log(`Date: ${result.REPDTE}`);
            console.log(`Assets (ASSET): ${result.ASSET}`);
            console.log(`Net Income (NETINC): ${result.NETINC}`);
            console.log(`Equity (EQ): ${result.EQ}`);
            console.log(`Net Loans (LNLSNET): ${result.LNLSNET}`);
            console.log(`Noncurrent Loans (NCLNLS): ${result.NCLNLS}`);
            console.log(`Nonaccrual Loans (LNLSN): ${result.LNLSN}`);
            console.log(`Past Due 90+ (P9GLNLS): ${result.P9GLNLS}`);

            // Calc check
            if (result.NCLNLS && result.LNLSNET) {
                console.log(`NPL (NCLNLS/Loans): ${(result.NCLNLS / result.LNLSNET) * 100}%`);
            } else if (result.LNLSN && result.LNLSNET) { // Partial NPL
                console.log(`NPL (Nonaccrual/Loans): ${(result.LNLSN / result.LNLSNET) * 100}%`);
            }
        } else {
            console.log('No data found');
        }
    } catch (e) {
        console.error(e);
    }
}

verifyFields();
