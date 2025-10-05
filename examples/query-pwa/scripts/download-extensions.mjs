// This script downloads the specified DuckDB extensions and places them in the
// public/extensions directory. This is to avoid committing binary files to the
// repository and to make the setup process smoother.
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DUCKDB_VERSION = 'v1.4.0';
const BUNDLE = 'wasm_eh';
const EXTENSIONS = ['json'];
const DEST_DIR = path.resolve(__dirname, `../public/extensions`);

async function downloadFile(url, dest) {
  console.log(`Downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, {recursive: true});
  }
  fs.writeFileSync(dest, Buffer.from(buffer));
  console.log(`Downloaded ${url} successfully.`);
}

async function main() {
  for (const extension of EXTENSIONS) {
    const fileName = `${extension}.duckdb_extension.wasm`;
    const destPath = path.join(DEST_DIR, DUCKDB_VERSION, BUNDLE, fileName);

    if (fs.existsSync(destPath)) {
      console.log(`${fileName} already exists. Skipping download.`);
      continue;
    }

    const url = `https://extensions.duckdb.org/${DUCKDB_VERSION}/${BUNDLE}/${fileName}`;
    try {
      await downloadFile(url, destPath);
    } catch (error) {
      console.error(`Failed to download ${extension}:`, error);
      process.exit(1);
    }
  }
}

main();
