import { promises as fs } from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve('src');

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }

    if (
      entry.isFile() &&
      entry.name.endsWith('.js') &&
      !entry.name.endsWith('.test.js') &&
      fullPath !== path.join(SRC_DIR, 'renderer', 'public', 'version.js')
    ) {
      await fs.unlink(fullPath);
    }
  }
}

async function main() {
  try {
    await walk(SRC_DIR);
  } catch (error) {
    console.error('[clean-src] Failed to clean generated JavaScript files:', error);
    process.exitCode = 1;
  }
}

await main();
