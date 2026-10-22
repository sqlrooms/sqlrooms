// Minimal upstream reproducer: no React, Mosaic, or Roomie imports.
import * as duckdb from './vendor/npm/package/dist/duckdb-browser.mjs';

const params = new URLSearchParams(location.search);
const rebuilt = params.get('extensions') === 'rebuilt';
const threads = params.get('threads') === '1' ? 1 : 2;
const debug = params.has('debug');
const workerRoot = debug ? '/vendor/debug/' : '/vendor/npm/package/dist/';
const output = document.querySelector('#result');
output.textContent = '';
const log = (value) => {
  output.textContent += `${JSON.stringify(value)}\n`;
};
const worker = new Worker(`${workerRoot}duckdb-browser-threads.worker.js`);
const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);
let timer;
try {
  await Promise.race([
    (async () => {
      await db.instantiate(
        '/vendor/npm/package/dist/duckdb-threads.wasm',
        `${workerRoot}duckdb-browser-threads.pthread.worker.js`,
      );
      // Both explicit experiment modes need these flags: published engine metadata
      // differs from release extensions, and rebuilt extensions are unsigned.
      await db.open({allowUnsignedExtensions: true, maximumThreads: threads});
      const connection = await db.connect();
      await connection.query('SET allow_extensions_metadata_mismatch=true');
      log({
        threads,
        rebuilt,
        crossOriginIsolated,
        version: (await connection.query('SELECT version() AS v')).toArray()[0]
          .v,
      });
      for (const extension of ['httpfs', 'quack']) {
        log({loading: extension});
        const directory = rebuilt ? 'rebuilt' : 'extensions/wasm_threads';
        await connection.query(
          `LOAD '${location.origin}/vendor/${directory}/${extension}.duckdb_extension.wasm'`,
        );
        log({loaded: extension});
      }
      log({status: 'PASS'});
    })(),
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Timed out after 15 seconds')),
        15000,
      );
    }),
  ]);
} catch (error) {
  log({status: 'FAIL', error: String(error)});
} finally {
  clearTimeout(timer);
  // Terminate directly: a hung C++ loader cannot answer a graceful close request.
  worker.terminate();
}
