/**
 * Script to replace console.log/error/warn with structured logger.
 * Run once to migrate all console statements to pino logger.
 * 
 * Usage: node --loader ts-node/esm scripts/migrate-logger.ts
 * (or just: npx ts-node scripts/migrate-logger.ts)
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.resolve(import.meta.dirname, '../src');
const LOGGER_IMPORT_RELATIVE: Record<string, string> = {};

function getRelativeLoggerImport(filePath: string): string {
    const fileDir = path.dirname(filePath);
    const loggerPath = path.resolve(SRC_DIR, 'utils/logger.ts');
    let rel = path.relative(fileDir, loggerPath).replace(/\.ts$/, '.js');
    if (!rel.startsWith('.')) rel = './' + rel;
    return rel;
}

function processFile(filePath: string): { modified: boolean; replacements: number } {
    let content = fs.readFileSync(filePath, 'utf-8');
    const original = content;
    let replacements = 0;

    // Skip files that ARE the logger itself or env.ts (which uses console.error on purpose before logger is available)
    const basename = path.basename(filePath);
    if (basename === 'logger.ts' || basename === 'env.ts') {
        return { modified: false, replacements: 0 };
    }

    // Count console statements
    const consoleRegex = /console\.(log|error|warn)\b/g;
    const matches = content.match(consoleRegex);
    if (!matches || matches.length === 0) {
        return { modified: false, replacements: 0 };
    }

    // Replace console.log -> logger.info, console.error -> logger.error, console.warn -> logger.warn
    content = content.replace(/console\.log\(/g, () => { replacements++; return 'logger.info('; });
    content = content.replace(/console\.error\(/g, () => { replacements++; return 'logger.error('; });
    content = content.replace(/console\.warn\(/g, () => { replacements++; return 'logger.warn('; });

    // Add logger import if not already present
    if (!content.includes("from '../utils/logger") && !content.includes("from './logger") && !content.includes("from '../../utils/logger")) {
        const loggerImport = getRelativeLoggerImport(filePath);
        // Add import after the last existing import
        const importRegex = /^import\s.*?;$/gm;
        let lastImportEnd = 0;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            lastImportEnd = match.index + match[0].length;
        }

        if (lastImportEnd > 0) {
            content = content.slice(0, lastImportEnd) + '\n' + `import logger from '${loggerImport}';` + content.slice(lastImportEnd);
        } else {
            content = `import logger from '${loggerImport}';\n` + content;
        }
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        return { modified: true, replacements };
    }

    return { modified: false, replacements: 0 };
}

function walkDir(dir: string): string[] {
    const files: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules') {
            files.push(...walkDir(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
            files.push(fullPath);
        }
    }
    return files;
}

// Main
const files = walkDir(SRC_DIR);
let totalModified = 0;
let totalReplacements = 0;

for (const file of files) {
    const result = processFile(file);
    if (result.modified) {
        const relPath = path.relative(SRC_DIR, file);
        console.log(`✅ ${relPath}: ${result.replacements} replacements`);
        totalModified++;
        totalReplacements += result.replacements;
    }
}

console.log(`\nDone! Modified ${totalModified} files with ${totalReplacements} total replacements.`);
