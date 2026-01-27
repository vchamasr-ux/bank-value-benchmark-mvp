import https from 'https';

const url = 'https://api.fdic.gov/banks/summary?filters=STNAME:Florida%20AND%20YEAR:2023&fields=ASSET,INTINC,INTEXP,NONII,NONIX,LNLSNET,NUMEMP&limit=1&format=json';

console.log(`Fetching FL Summary: ${url}`);

https.get(url, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('Records Found:', json.meta.total);
            console.log('First Record:', JSON.stringify(json.data[0], null, 2));
        } catch (e) { console.log(data); }
    });
});
