import https from 'https';

const options = {
    hostname: 'api.fdic.gov',
    path: '/banks/institutions?filters=NAME:*chase*&limit=1', // Note: trying without slash strictly to see, wait we know slash is needed
    path: '/banks/institutions/?filters=NAME:*chase*&fields=NAME,CERT&limit=1&format=json',
    method: 'GET',
    headers: { 'Origin': 'http://localhost:5173' }
};

console.log('Checking CORS headers...');
const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`CORS Header: ${res.headers['access-control-allow-origin']}`);
});
req.end();
