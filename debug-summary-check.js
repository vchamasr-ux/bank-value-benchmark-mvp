import https from 'https';

const url1 = 'https://api.fdic.gov/banks/summary?filters=ASSET:[0%20TO%20100000]%20AND%20YEAR:2023&fields=ASSET&limit=1&format=json';
const url2 = 'https://api.fdic.gov/banks/summary?filters=ASSET:[10000000%20TO%20*]%20AND%20YEAR:2023&fields=ASSET&limit=1&format=json';

const fetch = (url, name) => {
    https.get(url, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                const asset = json.data && json.data[0] ? json.data[0].data.ASSET : 'N/A';
                const id = json.data && json.data[0] ? json.data[0].data.ID : 'N/A';
                console.log(`${name}: ID=${id}, TotalAssets=${asset}`);
            } catch (e) { console.log(name, 'Error'); }
        });
    });
};

console.log('Testing Filter Support...');
fetch(url1, 'Small Banks');
fetch(url2, 'Big Banks');
