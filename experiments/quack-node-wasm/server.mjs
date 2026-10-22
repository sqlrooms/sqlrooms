import {randomBytes} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {DuckDBInstance} from '@duckdb/node-api';
import {createServer} from '../../apps/roomie-cli-ui/node_modules/vite/dist/node/index.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const runtime = `${root}.runtime`;
await mkdir(runtime, {recursive: true});
const db = await DuckDBInstance.create(':memory:', {
  extension_directory: `${runtime}/extensions`,
});
const connection = await db.connect();
let server;
let quackStarted = false;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  try {
    await server?.close();
  } finally {
    try {
      if (quackStarted) await connection.run(`CALL quack_stop('${uri}')`);
    } finally {
      connection.closeSync();
      db.closeSync();
    }
  }
}
const rows = async (sql) =>
  (await connection.runAndReadAll(sql)).getRowObjectsJson();
const token = randomBytes(24).toString('hex');
const uri = 'quack:127.0.0.1:19494';
try {
  await connection.run(`
  CREATE TABLE sales AS SELECT i::INTEGER AS id,
    (20 + (i * 37) % 180)::DOUBLE AS amount FROM range(120) t(i);
  INSTALL quack; LOAD quack;
`);
  await connection.run(`CALL quack_serve('${uri}', token='${token}')`);
  quackStarted = true;
  const nativeVersion = (await rows('SELECT version() AS version'))[0].version;
  const extensions = await rows(
    'SELECT extension_name, extension_version FROM duckdb_extensions() WHERE loaded',
  );
  const config = {uri, token, nativeVersion, extensions};
  server = await createServer({
    root,
    configFile: false,
    resolve: {
      dedupe: ['react', 'react-dom', '@uwdata/mosaic-core', '@uwdata/vgplot'],
      alias: {
        '@uwdata/mosaic-core': `${root}../../packages/mosaic/node_modules/@uwdata/mosaic-core`,
        'apache-arrow': `${root}../../packages/mosaic/node_modules/apache-arrow`,
      },
    },
    server: {
      host: '127.0.0.1',
      port: 4317,
      strictPort: true,
      headers:
        process.env.POC_THREADS === '1'
          ? {
              'Cross-Origin-Opener-Policy': 'same-origin',
              'Cross-Origin-Embedder-Policy': 'require-corp',
            }
          : {},
    },
    plugins: [
      {
        name: 'poc-config',
        configureServer(vite) {
          vite.middlewares.use('/config.json', (_req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify(config));
          });
        },
      },
    ],
  });
  await server.listen();
  console.log(
    JSON.stringify(
      {nativeVersion, extensions, url: 'http://127.0.0.1:4317', uri},
      null,
      2,
    ),
  );
  process.on(
    'SIGINT',
    () =>
      void stop().catch((error) => {
        console.error(error);
        process.exitCode = 1;
      }),
  );
  process.on(
    'SIGTERM',
    () =>
      void stop().catch((error) => {
        console.error(error);
        process.exitCode = 1;
      }),
  );
} catch (error) {
  try {
    await stop();
  } catch (cleanupError) {
    console.error('Cleanup failed:', cleanupError);
  }
  throw error;
}
