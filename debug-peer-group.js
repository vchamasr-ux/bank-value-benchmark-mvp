import https from 'https';

const fields = 'ASSET,NUMEMP,INTINC,INTEXP,NONII,NONIX,LNLSNET,STNAME,STALP';
const url = `https://banks.data.fdic.gov/api/financials/?filters=ASSET:[1000000%20TO%205000000]%20AND%20ACTIVE:1&fields=${fields}&limit=5&format=json`;

console.log(`Fetching: ${url}`);

const req = https.get(url, res => {
    // Handle redirects
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log(`Redirecting to: ${res.headers.location}`);
        https.get(res.headers.location, res2 => handleResponse(res2));
        return;
    }
    handleResponse(res);
});

function handleResponse(res) {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        try {
            console.log('Status:', res.statusCode);
            if (res.statusCode !== 200) {
                console.log('Body:', data.substring(0, 200));
                return;
            }
            const json = JSON.parse(data);
            const items = json.data;
            if (!items) { console.log('No data'); return; }

            console.log(`Fetched ${items.length} items.`);
            items.forEach((item, i) => {
                const d = item.data;
                console.log(`Bank ${i}: STNAME=${d.STNAME}, STALP=${d.STALP}, ASSET=${d.ASSET}`);
            });

        } catch (e) {
            console.log('Error parsing JSON:', e);
            console.log('Raw data start:', data.substring(0, 100));
        }
    });
}

