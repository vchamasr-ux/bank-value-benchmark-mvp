import https from 'https';
import fs from 'fs';

const certId = '26323';
const fields = 'ASSET,NUMEMP,INTINC,INTEXP,LNLSNET';
const url = `https://banks.data.fdic.gov/api/financials/?filters=CERT:${certId}&fields=${fields}&limit=1&format=json`;

console.log(`Checking URL: ${url}`);

https.get(url, (res) => {
    console.log(`Status: ${res.statusCode}`);
    if (res.statusCode >= 300 && res.statusCode < 400) {
        fs.writeFileSync('redirect_log.txt', `REDIRECT_TO: ${res.headers.location}`);
        console.log('Redirect logged to file.');
    } else {
        res.on('data', () => { });
        res.on('end', () => console.log('Response OK (200)'));
    }
}).on("error", (e) => console.log(e.message));
