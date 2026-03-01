const fs = require('fs');
const path = require('path');
const { SourceMapConsumer } = require('source-map');

(async () => {
    const assetsDir = path.join(__dirname, 'dist', 'assets');
    const files = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));

    for (const file of files) {
        const content = fs.readFileSync(path.join(assetsDir, file), 'utf8');
        const mapPath = path.join(assetsDir, file + '.map');
        if (!fs.existsSync(mapPath)) continue;

        const mapContent = fs.readFileSync(mapPath, 'utf8');

        // Find all "const H="
        const regex = /(?:const|let|var|class)\s+H(?:\s*=|{)/g;
        let match;
        const positions = [];

        const lines = content.split('\n');

        while ((match = regex.exec(content)) !== null) {
            // Calculate line and column of match.index
            let line = 1;
            let col = 0;
            for (let i = 0; i < match.index; i++) {
                if (content[i] === '\n') {
                    line++;
                    col = 0;
                } else {
                    col++;
                }
            }
            // Move col forward to point at 'H'
            const prefix = match[0].substring(0, match[0].indexOf('H'));
            col += prefix.length;
            positions.push({ line, col });
        }

        console.log(`Found ${positions.length} occurrences in ${file}`);

        if (positions.length > 0) {
            const parsedMap = JSON.parse(mapContent);
            const consumer = new SourceMapConsumer(parsedMap);
            for (const pos of positions) {
                const original = consumer.originalPositionFor({
                    line: pos.line,
                    column: pos.col
                });
                console.log(`H maps to: ${original.name} at ${original.source}:${original.line}:${original.column}`);
            }
        }
    }
})();
