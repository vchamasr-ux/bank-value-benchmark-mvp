import https from 'https';

const certId = '17509'; // First State Bank of the Florida Keys
const fields = 'REPDTE,ASSET,NUMEMP,INTINC,INTEXP,EINTEXP,NONII,NONIX,LNLSNET';
const url = `https://api.fdic.gov/banks/financials/?filters=CERT:${certId}&fields=${fields}&limit=1&sort_by=REPDTE&sort_order=DESC&format=json`;

console.log(`Fetching: ${url}`);

https.get(url, (res) => {
    let data = '';
    console.log(`Status Code: ${res.statusCode}`);

    res.on('data', (chunk) => { data += chunk; });

    res.on('end', () => {
        try {
            const json = JSON.parse(data);

            // 1. Verify Structure
            if (!json.data || !Array.isArray(json.data)) {
                console.error('FAIL: Root "data" array missing.');
                return;
            }
            if (json.data.length === 0) {
                console.error('FAIL: No records found.');
                return;
            }
            const record = json.data[0].data;
            if (!record) {
                console.error('FAIL: "data[0].data" object missing.');
                return;
            }

            console.log('Structure OK: data.data[0].data exists.');

            // 2. Verify Fields
            const requiredFields = ['ASSET', 'NUMEMP', 'INTINC', 'INTEXP', 'LNLSNET'];
            const missing = [];
            requiredFields.forEach(f => {
                if (record[f] === undefined || record[f] === null) {
                    missing.push(f);
                } else {
                    console.log(`Field ${f}: ${record[f]}`);
                }
            });

            if (missing.length > 0) {
                console.error(`FAIL: Missing fields: ${missing.join(', ')}`);
            } else {
                console.log('SUCCESS: All required fields are present.');
            }

        } catch (e) {
            console.error('Error parsing JSON:', e.message);
            console.log('Raw body:', data.substring(0, 500));
        }
    });

}).on("error", (err) => {
    console.log("Error: " + err.message);
});
