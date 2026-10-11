import {cp, mkdir, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const app = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(
  app,
  '../../python/sqlrooms/sqlrooms/claude_plugin',
);
await rm(output, {recursive: true, force: true});
await mkdir(output, {recursive: true});
await cp(
  path.join(app, 'claude-plugin/.claude-plugin'),
  path.join(output, '.claude-plugin'),
  {recursive: true},
);
await cp(
  path.join(app, 'claude-plugin/mcp.json'),
  path.join(output, 'mcp.json'),
);
await cp(
  path.join(app, 'skills/sqlrooms'),
  path.join(output, 'skills/sqlrooms'),
  {recursive: true},
);

await cp(
  path.join(app, 'claude-plugin/headers.mjs'),
  path.join(output, 'headers.mjs'),
);
