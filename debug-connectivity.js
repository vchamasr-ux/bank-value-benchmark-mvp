import https from 'https';
import http from 'http';

function checkCors() {
    console.log('--- Test 1: Checking Upstream CORS ---');
    const options = {
        hostname: 'api.fdic.gov',
        path: '/banks/institutions/?filters=NAME:*chase*&fields=NAME,CERT&limit=1&format=json',
        method: 'GET',
        headers: { 'Origin': 'http://localhost:5173' }
    };

    const req = https.request(options, (res) => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Access-Control-Allow-Origin: ${res.headers['access-control-allow-origin']}`);

        res.resume(); // consume

        checkProxy(); // Chain next test
    });

    req.on('error', (e) => {
        console.error(`Upstream Request Error: ${e.message}`);
        checkProxy();
    });
    req.end();
}

function checkProxy() {
    console.log('\n--- Test 2: Checking Local Proxy ---');
    const options = {
        hostname: 'localhost',
        port: 5173,
        path: '/fdic-api/institutions/?filters=NAME:*chase*&fields=NAME,CERT&limit=1&format=json',
        method: 'GET'
    };

    const req = http.request(options, (res) => {
        console.log(`Status: ${res.statusCode}`);
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            if (data.includes('<!doctype html>') || data.includes('<html')) {
                console.log('Proxy Result: Returned HTML (Proxy NOT matching path)');
            } else {
                console.log('Proxy Result Data:', data.substring(0, 200));
            }
        });
    });

    req.on('error', (e) => {
        console.error(`Local Proxy Error: ${e.message}`);
    });
    req.end();
}

checkCors();
