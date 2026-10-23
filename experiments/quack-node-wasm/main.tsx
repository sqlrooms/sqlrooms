import React from 'react';
import {createRoot} from 'react-dom/client';
import * as duckdb from './vendor/npm/package/dist/duckdb-browser.mjs';
import {coordinator} from '@uwdata/mosaic-core';
import {VgPlotChart} from '../../packages/mosaic/dist/VgPlotChart';
import {createHistogramSpec} from '../../packages/mosaic/dist/charts/chart-types/histogram/spec';
import {createMosaicTableFromArrowTable} from '../../packages/mosaic/dist/tableInterop';
import {makeQualifiedTableName} from '../../packages/duckdb-core/dist/duckdb-utils';
import './style.css';

const status = document.querySelector('#status')!;
const queries = document.querySelector('#queries')!;
const log = (value: unknown) => {
  queries.textContent += `${JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? String(v) : v))}\n`;
};

try {
  const config = await (await fetch('/config.json')).json();
  const params = new URLSearchParams(location.search);
  const localControl = params.has('local-control');
  const ciCompatibility = params.has('ci-compat');
  const prefix = '/vendor/npm/package/dist/';
  const threaded = params.has('threads');
  const rebuilt = params.has('rebuilt');
  if (rebuilt && (!threaded || !ciCompatibility || localControl)) {
    throw new Error(
      'Rebuilt extensions require threads=1 and ci-compat=1, without local-control.',
    );
  }
  const worker = new Worker(
    `${prefix}duckdb-browser-${threaded ? 'threads' : 'base'}.worker.js`,
  );
  const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);
  await db.instantiate(
    `${prefix}duckdb-${threaded ? 'threads' : 'base'}.wasm`,
    threaded ? `${prefix}duckdb-browser-threads.pthread.worker.js` : undefined,
  );
  await db.open({
    allowUnsignedExtensions: ciCompatibility,
    // Keep the threaded runtime for Quack heartbeats, but avoid the observed
    // dynamic-loader hang when more than one query thread is configured.
    maximumThreads: threaded && !rebuilt ? 2 : 1,
  });
  const connection = await db.connect();
  const wasmVersion = (
    await connection.query('SELECT version() AS version')
  ).toArray()[0].version;
  status.textContent = `Native ${config.nativeVersion}; Wasm ${wasmVersion}. Loading Quack…`;
  log({nativeVersion: config.nativeVersion, wasmVersion, rebuilt, threaded});
  log((await connection.query('PRAGMA platform')).toArray());
  // CI built the exact v2.0.0 source commit before release tagging, so its
  // extension ABI identifier is d54cbbe3df rather than v2.0.0. POC only.
  if (ciCompatibility && !localControl) {
    await connection.query('SET allow_extensions_metadata_mismatch=true');
    log({
      warning: rebuilt
        ? 'POC ONLY: loading locally rebuilt unsigned extensions with metadata checks relaxed.'
        : 'POC ONLY: signature and version checks relaxed for the checksum-pinned official extension built from the identical v2.0.0 source commit.',
    });
  }
  if (localControl) {
    await connection.query(`CREATE TABLE sales AS SELECT i::INTEGER AS id,
      (20 + (i * 37) % 180)::DOUBLE AS amount FROM range(120) t(i)`);
  } else {
    let extensionDirectory = 'extensions';
    if (threaded) extensionDirectory = 'extensions/wasm_threads';
    if (rebuilt) extensionDirectory = 'rebuilt';
    for (const extension of ['httpfs', 'quack']) {
      await connection.query(
        `LOAD '${location.origin}/vendor/${extensionDirectory}/${extension}.duckdb_extension.wasm'`,
      );
    }
    await connection.query(
      `ATTACH '${config.uri}' AS remote_db (TOKEN '${config.token}'); CONNECT remote_db;`,
    );
  }
  const proof = await connection.query(
    'SELECT version() AS remote_version, count(*)::INTEGER AS rows, sum(amount)::DOUBLE AS total FROM sales',
  );
  log({
    mode: localControl ? 'LOCAL CONTROL — NOT QUACK' : 'REMOTE QUACK',
    queryProof: proof.toArray(),
  });

  coordinator().databaseConnector({
    async query({sql, type}: {sql: string; type: string}) {
      log({type, sql});
      const result = await connection.query(sql);
      log({
        rows: result.numRows,
        fields: result.schema.fields.map((f) => ({
          name: f.name,
          type: String(f.type),
        })),
      });
      if (type === 'exec') return undefined;
      if (type === 'json') return result.toArray().map((row) => row.toJSON());
      return createMosaicTableFromArrowTable(result);
    },
  });
  const spec = createHistogramSpec({
    dataTable: {
      table: makeQualifiedTableName({
        database: 'memory',
        schema: 'main',
        table: 'sales',
      }),
      columns: [
        {name: 'id', type: 'INTEGER'},
        {name: 'amount', type: 'DOUBLE'},
      ],
    },
    settings: {field: 'amount', maxBins: 12, color: '#3066be'},
  });
  createRoot(document.querySelector('#chart')!).render(
    <VgPlotChart spec={spec} />,
  );
  status.textContent = localControl
    ? `LOCAL CONTROL ONLY: Wasm ${wasmVersion} · 120 browser-local rows · this does not verify Quack`
    : `Connected: native ${config.nativeVersion} · Wasm ${wasmVersion} · 120 server-owned sales rows`;
} catch (error) {
  status.textContent = `FAILED: ${error instanceof Error ? error.message : String(error)}`;
  console.error(error);
}
