import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('PAGE ERROR:', msg.text());
        }
    });

    page.on('pageerror', error => {
        console.log('UNCAUGHT PAGE ERROR:', error.message);
        console.log('STACK:', error.stack);
    });

    try {
        await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
        console.log("Page loaded.");
    } catch (e) {
        console.log("Failed to load page:", e);
    }

    await browser.close();
})();
