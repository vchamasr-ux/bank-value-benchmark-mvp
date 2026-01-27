import https from 'https';

const url = 'https://api.fdic.gov/banks/summary?filters=YEAR:2023&fields=ASSET,INTINC,INTEXP,NONII,NONIX&limit=1&format=json';

console.log(`Fetching Summary: ${url}`);

https.get(url, (res) => {
    let data = '';
    console.log(`Status: ${res.statusCode}`);
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            console.log('Response Preview:', data.substring(0, 500));
            const json = JSON.parse(data);
            console.log('Data:', JSON.stringify(json.data, null, 2));
        } catch (e) {
            console.log('Error parsing JSON');
        }
    });
}).on("error", (e) => console.log(e.message));
