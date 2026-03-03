const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/');
  
  // Search for chase
  await page.fill('input[placeholder="Enter bank name..."]', 'chase');
  await page.click('button[type="submit"]');
  
  // Wait for results and click first
  await page.waitForSelector('ul[role="listbox"] li:has-text("CHASE")');
  await page.click('ul[role="listbox"] li:has-text("CHASE")');
  
  // Wait for dashboard to load
  await page.waitForSelector('h2:has-text("Financial Health Scorecard")');
  
  // Take screenshot
  await page.screenshot({ path: 'local_dashboard.png', fullPage: true });
  await browser.close();
})();
