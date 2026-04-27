const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const distDir = join(process.cwd(), 'dist');
const targetFile = join(distDir, 'main.js');

mkdirSync(distDir, { recursive: true });
writeFileSync(targetFile, "require('./web/main');\n", 'utf8');
