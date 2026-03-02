import fs from 'fs';
import path from 'path';

const dirsToClean = ['test-results', 'playwright-report', 'dist', '.nyc_output', 'coverage'];

dirsToClean.forEach(dir => {
    const dirPath = path.resolve(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
        console.log(`🧹 Removing directory: ${dirPath}`);
        fs.rmSync(dirPath, { recursive: true, force: true });
    } else {
        console.log(`✅ Directory ${dirPath} does not exist, skipping.`);
    }
});

console.log("🚀 Storage cleanup complete.");
