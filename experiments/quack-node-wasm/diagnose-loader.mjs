// Adds logging only to local generated worker copies; leaves the npm files intact.
// Run prepare-vendor.sh first so the source tarball is checksum-verified.
import {mkdir, readFile, writeFile} from 'node:fs/promises';

const source = new URL('./vendor/npm/package/dist/', import.meta.url);
const target = new URL('./vendor/debug/', import.meta.url);
await mkdir(target, {recursive: true});
for (const name of [
  'duckdb-browser-threads.worker.js',
  'duckdb-browser-threads.pthread.worker.js',
]) {
  const code = await readFile(new URL(name, source), 'utf8');
  const marker = 'dlSetError=e=>{';
  if (code.split(marker).length !== 2) {
    throw new Error(`Expected exactly one dlSetError marker in ${name}`);
  }
  await writeFile(
    new URL(name, target),
    code.replace(marker, `${marker}console.error('DLOPEN_DIAGNOSTIC',e);`),
  );
}
console.log('Open /loader-probe.html?debug=1 and inspect the browser console.');
