import https from 'https';

// Peer Group: Assets $1B - $10B
const assetFilter = 'ASSET:[1000000 TO 10000000]';
const year = 2023;
// We suspect 'count' might be in the root or meta, or maybe we need to request it as a field??
// Actually, /summary usually calculates sums. 
// Can we request "count"? or is it automatic?
const url = `https://api.fdic.gov/banks/summary?filters=${encodeURIComponent(assetFilter)}%20AND%20YEAR:${year}&fields=ASSET,INTINC&limit=1&format=json`;

console.log(`Fetching Summary: ${url}`);

https.get(url, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('Meta:', JSON.stringify(json.meta, null, 2));
            if (json.data && json.data.length > 0) {
                console.log('Record [0]:', JSON.stringify(json.data[0], null, 2));
            }
        } catch (e) { console.log(data); }
    });
});
