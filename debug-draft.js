import fetch from 'node-fetch';

async function checkCors() {
    console.log('--- Test 1: Checking Upstream CORS ---');
    const url = 'https://api.fdic.gov/banks/institutions/?filters=NAME:*chase*&fields=NAME,CERT&limit=1&format=json';
    try {
        const res = await fetch(url, {
            headers: { 'Origin': 'http://localhost:5173' }
        });
        console.log(`Status: ${res.status}`);
        console.log(`CORS Header: ${res.headers.get('access-control-allow-origin')}`);
        if (res.ok) console.log('Upstream Fetch Success');
    } catch (e) {
        console.log('Upstream Fetch Failed:', e.message);
    }
}

async function checkProxy() {
    console.log('\n--- Test 2: Checking Local Proxy ---');
    const url = 'http://localhost:5173/fdic-api/institutions/?filters=NAME:*chase*&fields=NAME,CERT&limit=1&format=json';
    try {
        const res = await fetch(url);
        console.log(`Status: ${res.status}`);
        const text = await res.text();
        if (text.includes('<!doctype html>') || text.includes('<html')) {
            console.log('Proxy Failed: Returned HTML (likely Vite index page)');
        } else {
            console.log('Proxy Response Preview:', text.substring(0, 100));
        }
    } catch (e) {
        console.log('Local Proxy Fetch Failed:', e.message);
    }
}

// Run (fetch is built-in to Node 18+, if older might need package, but let's try built-in or import)
// Actually "import fetch" might fail if not in node_modules?
// Vite projects usually have "type": "module" so imports work, but 'node-fetch' isn't installed.
// We'll use built-in fetch (Node 18+) or https. Let's use https to be safe as previously.
