import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const port = Number.parseInt(
  process.env.SQLROOMS_AI_DEVTOOLS_BRIDGE_PORT ?? '4984',
  10,
);
const viewerPort = Number.parseInt(
  process.env.AI_SDK_DEVTOOLS_PORT ?? '4983',
  10,
);
const dbDir = path.join(process.cwd(), '.devtools');
const dbPath = path.join(dbDir, 'generations.json');
const allowedOrigins = new Set([
  'http://localhost:4174',
  'http://127.0.0.1:4174',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

function emptyDb() {
  return {runs: [], steps: []};
}

function readDb() {
  try {
    if (fs.existsSync(dbPath)) {
      return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    }
  } catch {
    // fall through
  }
  return emptyDb();
}

function writeDb(db) {
  fs.mkdirSync(dbDir, {recursive: true});
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

async function notifyViewer(event) {
  try {
    await fetch(`http://localhost:${viewerPort}/api/notify`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({event, timestamp: Date.now()}),
    });
  } catch {
    // viewer might still be starting; the UI can refresh manually
  }
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, {'Content-Type': 'application/json'});
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, {error: 'Method not allowed'});
    return;
  }

  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const body = await readJson(req);
    const db = readDb();

    if (url.pathname === '/api/runs') {
      if (!db.runs.some((run) => run.id === body.id)) {
        db.runs.push({
          id: body.id,
          started_at: body.started_at ?? new Date().toISOString(),
        });
      }
      writeDb(db);
      await notifyViewer('run');
      sendJson(res, 200, {success: true});
      return;
    }

    if (url.pathname === '/api/steps') {
      if (!db.steps.some((step) => step.id === body.id)) {
        db.steps.push({
          ...body,
          duration_ms: null,
          output: null,
          usage: null,
          error: null,
          raw_request: null,
          raw_response: null,
          raw_chunks: null,
        });
      }
      writeDb(db);
      await notifyViewer('step');
      sendJson(res, 200, {success: true});
      return;
    }

    const resultMatch = url.pathname.match(/^\/api\/steps\/([^/]+)\/result$/);
    if (resultMatch) {
      const step = db.steps.find(
        (candidate) => candidate.id === resultMatch[1],
      );
      if (step) {
        Object.assign(step, body);
        writeDb(db);
        await notifyViewer('step-update');
      }
      sendJson(res, 200, {success: true});
      return;
    }

    sendJson(res, 404, {error: 'Not found'});
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`AI SDK DevTools bridge port ${port} is already in use.`);
    process.exit(1);
  }
  throw error;
});

server.listen(port, '127.0.0.1', () => {
  console.log(
    `SQLRooms AI SDK DevTools bridge running at http://127.0.0.1:${port}`,
  );
});
