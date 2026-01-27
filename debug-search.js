import https from 'https';
import fs from 'fs';

const name = 'chase';
const FDIC_API_BASE = 'https://banks.data.fdic.gov/api/institutions/';
const filters = `NAME:*${name}* AND ACTIVE:1`;
const fields = 'NAME,CITY,STNAME,CERT';
const limit = 10;
const url = `${FDIC_API_BASE}?filters=${encodeURIComponent(filters)}&fields=${fields}&limit=${limit}&format=json`;

console.log(`Checking URL: ${url}`);

https.get(url, (res) => {
    console.log(`Status: ${res.statusCode}`);
    if (res.statusCode >= 300 && res.statusCode < 400) {
        fs.writeFileSync('redirect_log_search.txt', `REDIRECT_TO: ${res.headers.location}`);
        console.log('Redirect logged to file.');
    } else {
        res.on('data', () => { });
        res.on('end', () => console.log('Response OK (200)'));
    }
}).on("error", (e) => console.log(e.message));
