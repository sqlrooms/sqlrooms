import fs from 'node:fs';
import path from 'node:path';
import type {IncomingMessage, ServerResponse} from 'node:http';
import {fileURLToPath} from 'node:url';
import type {Plugin} from 'vite';

type DevtoolsRun = {
  id: string;
  started_at: string;
};

type DevtoolsStep = {
  id: string;
  run_id: string;
  step_number: number;
  type: 'generate' | 'stream';
  model_id: string;
  provider: string | null;
  started_at: string;
  input: string;
  provider_options: string | null;
  duration_ms: number | null;
  output: string | null;
  usage: string | null;
  error: string | null;
  raw_request: string | null;
  raw_response: string | null;
  raw_chunks: string | null;
};

type DevtoolsDb = {
  runs: DevtoolsRun[];
  steps: DevtoolsStep[];
};

type DevtoolsEvent =
  | {type: 'create-run'; run: DevtoolsRun}
  | {type: 'create-step'; step: DevtoolsStep}
  | {type: 'update-step'; stepId: string; patch: Partial<DevtoolsStep>};

const DEVTOOLS_ROUTE = '/__sqlrooms_ai_devtools';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function ensureGitignore(rootDir: string): void {
  const gitignorePath = path.join(rootDir, '.gitignore');
  if (!fs.existsSync(gitignorePath)) return;

  const content = fs.readFileSync(gitignorePath, 'utf8');
  const alreadyIgnored = content
    .split('\n')
    .some(
      (line) => line.trim() === '.devtools' || line.trim() === '.devtools/',
    );
  if (alreadyIgnored) return;

  fs.writeFileSync(
    gitignorePath,
    `${content}${content.endsWith('\n') ? '' : '\n'}.devtools\n`,
  );
}

function readDb(dbPath: string): DevtoolsDb {
  try {
    if (fs.existsSync(dbPath)) {
      return JSON.parse(fs.readFileSync(dbPath, 'utf8')) as DevtoolsDb;
    }
  } catch {
    // Fall through and recreate the lightweight local dev database.
  }
  return {runs: [], steps: []};
}

function writeDb(rootDir: string, dbPath: string, db: DevtoolsDb): void {
  fs.mkdirSync(path.dirname(dbPath), {recursive: true});
  ensureGitignore(rootDir);
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

async function notifyViewer(): Promise<void> {
  const port = process.env.AI_SDK_DEVTOOLS_PORT
    ? Number(process.env.AI_SDK_DEVTOOLS_PORT)
    : 4983;
  try {
    await fetch(`http://localhost:${port}/api/notify`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        event: 'sqlrooms-step-update',
        timestamp: Date.now(),
      }),
    });
  } catch {
    // The viewer is optional; the database file is still useful on refresh.
  }
}

function applyEvent(db: DevtoolsDb, event: DevtoolsEvent): DevtoolsDb {
  if (event.type === 'create-run') {
    if (!db.runs.some((run) => run.id === event.run.id)) {
      db.runs.push(event.run);
    }
    return db;
  }

  if (event.type === 'create-step') {
    const existingIndex = db.steps.findIndex(
      (step) => step.id === event.step.id,
    );
    if (existingIndex === -1) {
      db.steps.push(event.step);
    } else {
      db.steps[existingIndex] = event.step;
    }
    return db;
  }

  const step = db.steps.find((candidate) => candidate.id === event.stepId);
  if (step) {
    Object.assign(step, event.patch);
  }
  return db;
}

function respond(res: ServerResponse, statusCode: number, body = ''): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(body);
}

export default function aiDevtoolsPlugin(): Plugin {
  const rootDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../..',
  );
  const dbPath = path.join(rootDir, '.devtools', 'generations.json');

  return {
    name: 'sqlrooms-ai-devtools',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(DEVTOOLS_ROUTE, async (req, res) => {
        if (req.method !== 'POST') {
          respond(res, 405, JSON.stringify({error: 'Method not allowed'}));
          return;
        }

        try {
          const body = await readBody(req);
          const event = JSON.parse(body) as DevtoolsEvent;
          const db = applyEvent(readDb(dbPath), event);
          writeDb(rootDir, dbPath, db);
          void notifyViewer();
          respond(res, 204);
        } catch (error) {
          respond(
            res,
            400,
            JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      });
    },
  };
}
