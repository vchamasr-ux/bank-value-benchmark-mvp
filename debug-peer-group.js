import https from 'https';

const fields = 'ASSET,NUMEMP,INTINC,INTEXP,NONII,NONIX,LNLSNET';
const url = `https://api.fdic.gov/banks/financials/?filters=ASSET:[1000000%20TO%2010000000]%20AND%20ACTIVE:1&fields=${fields}&limit=5&format=json`;

console.log(`Fetching: ${url}`);

https.get(url, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            const items = json.data;
            if (!items) { console.log('No data'); return; }

            console.log(`Fetched ${items.length} items.`);
            items.forEach((item, i) => {
                const d = item.data;
                console.log(`Bank ${i}: ASSET=${d.ASSET}, INTEXP=${d.INTEXP}, INTINC=${d.INTINC}`);
            });

        } catch (e) { console.log(e); }
    });
});
