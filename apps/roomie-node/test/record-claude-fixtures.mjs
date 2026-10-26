import {spawn} from 'node:child_process';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {createInterface} from 'node:readline';
import {randomUUID} from 'node:crypto';
// Opt-in recording tool, never a production harness adapter. Use a fresh
// synthetic host seeded with test/live-m2.mjs, not a personal workspace.
if (
  !process.argv[2] ||
  !['short', 'tools', 'denied', 'cancel'].includes(process.argv[3])
)
  throw Error(
    'Usage: node test/record-claude-fixtures.mjs SYNTHETIC_WORKSPACE short|tools|denied|cancel',
  );
const directory = resolve(process.argv[2]);
const scenario = process.argv[3];
const control = JSON.parse(await readFile(`${directory}/control.json`, 'utf8'));
const credential = JSON.parse(await readFile(control.credentialPath, 'utf8'));
if (new URL(credential.mcpUrl).hostname !== '127.0.0.1')
  throw Error('Only a loopback fixture host is supported.');
const captureDir = await mkdtemp(join(directory, 'claude-capture-'));
const configPath = `${captureDir}/mcp.json`;
await writeFile(
  configPath,
  JSON.stringify({
    mcpServers:
      scenario === 'short'
        ? {}
        : {
            roomie: {
              type: 'http',
              url: credential.mcpUrl,
              headers: {Authorization: `Bearer ${credential.token}`},
            },
          },
  }),
  {mode: 0o600},
);
const skill = await readFile(
  new URL('../skills/roomie/SKILL.md', import.meta.url),
  'utf8',
);
const prompts = {
  short: 'Reply exactly with: Roomie fixture recorded.',
  tools:
    'Create a monthly revenue report in this synthetic Roomie workspace. First discover commands, inspect saved workspace knowledge, and query the data to verify revenue at the correct grain and refund exclusion. Then author one document titled Claude revenue fixture containing the verified monthly values, definition/source SQL, and a real line chart using the approved materialized source. Discover and inspect schemas before use; use durable operation IDs. Use only Roomie MCP. End with the document ID and exact monthly values.',
  denied:
    'Call Roomie search_commands once with query "block-document.create". The recording operator will deny permission. If denied, do not retry or use another tool. Explain that the action was denied without claiming that it ran.',
  cancel:
    'Call Roomie search_commands once with query "block-document.list". Wait for the recording operator permission before proceeding; do not use any other tools.',
};
if (!prompts[scenario]) throw Error('Unknown scenario');
const args = [
  '-p',
  '--input-format',
  'stream-json',
  '--output-format',
  'stream-json',
  '--verbose',
  '--include-partial-messages',
  '--no-session-persistence',
  '--restricted',
  '--setting-sources',
  '',
  '--settings',
  '{"disableAllHooks":true}',
  '--tools',
  '',
  '--disable-slash-commands',
  '--no-chrome',
  '--strict-mcp-config',
  '--mcp-config',
  configPath,
  '--permission-mode',
  'manual',
  '--permission-prompt-tool',
  'stdio',
  '--max-turns',
  '24',
  '--system-prompt',
  `You are recording a synthetic Roomie contract fixture. Use only the explicitly available tools. Never access credentials or unrelated data.\n${skill}`,
];
const child = spawn('claude', args, {
  cwd: captureDir,
  stdio: ['pipe', 'pipe', 'pipe'],
  detached: true,
});
const records = [];
let total = 0;
let lineBytes = 0;
let outputLimitReached = false;
let stopping = false;
let error = '';
let result;
let sent = false;
let cancelled = false;
let stopTimer;
function record(direction, message) {
  records.push({at: new Date().toISOString(), direction, message});
}
function send(message) {
  record('in', message);
  child.stdin.write(JSON.stringify(message) + '\n');
}
function kill(signal) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}
const deadline = setTimeout(() => {
  record('host', {type: 'deadline'});
  kill('SIGKILL');
}, 240000);
child.stderr.on('data', (data) => {
  error += data;
  if (error.length > 64000) kill('SIGKILL');
});
const exit = new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('close', (code, signal) => resolve({code, signal}));
});
child.stdin.on('error', () => {});
// Enforce byte bounds before readline can buffer a newline-free native frame.
child.stdout.on('data', (chunk) => {
  total += chunk.length;
  for (const byte of chunk) {
    lineBytes = byte === 10 ? 0 : lineBytes + 1;
    if (total > 8000000 || lineBytes > 2000000) {
      outputLimitReached = true;
      record('host', {type: 'output-limit'});
      reader.close();
      child.stdout.destroy();
      kill('SIGKILL');
      break;
    }
  }
});
const reader = createInterface({input: child.stdout});
function stop(signal) {
  if (stopping) return;
  stopping = true;
  record('host', {type: 'operator-stop', signal});
  kill('SIGTERM');
  clearTimeout(stopTimer);
  stopTimer = setTimeout(() => kill('SIGKILL'), 1000);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
reader.on('line', (line) => {
  if (outputLimitReached || stopping) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  record('out', message);
  if (
    message.type === 'control_response' &&
    message.response.request_id === 'initialize' &&
    !sent
  ) {
    sent = true;
    send({
      type: 'user',
      uuid: randomUUID(),
      message: {role: 'user', content: prompts[scenario]},
      parent_tool_use_id: null,
      session_id: '',
    });
  }
  if (message.type === 'control_request') {
    const req = message.request;
    if (req.subtype === 'can_use_tool') {
      console.log(JSON.stringify({scenario, permission: req.tool_name}));
      if (scenario === 'cancel') {
        cancelled = true;
        send({
          type: 'control_request',
          request_id: 'cancel',
          request: {subtype: 'interrupt'},
        });
        stopTimer = setTimeout(() => kill('SIGTERM'), 1000);
        return;
      }
      const allow =
        scenario === 'tools' &&
        [
          'mcp__roomie__search_commands',
          'mcp__roomie__get_command',
          'mcp__roomie__execute_command',
          'mcp__roomie__query',
        ].includes(req.tool_name);
      send({
        type: 'control_response',
        response: {
          subtype: 'success',
          request_id: message.request_id,
          response: allow
            ? {
                behavior: 'allow',
                updatedInput: req.input,
                toolUseID: req.tool_use_id,
              }
            : {
                behavior: 'deny',
                message: 'Denied by the fixture operator. Do not retry.',
                toolUseID: req.tool_use_id,
              },
        },
      });
    } else {
      send({
        type: 'control_response',
        response: {
          subtype: 'error',
          request_id: message.request_id,
          error: 'Unsupported recording control request',
        },
      });
    }
  }
  if (message.type === 'result') {
    result = message;
    child.stdin.end();
  }
});
send({
  type: 'control_request',
  request_id: 'initialize',
  request: {subtype: 'initialize', hooks: {}, agents: {}, skills: []},
});
let exited;
try {
  exited = await exit;
} finally {
  clearTimeout(deadline);
  clearTimeout(stopTimer);
  process.off('SIGINT', stop);
  process.off('SIGTERM', stop);
  reader.close();
  await rm(configPath, {force: true});
}
record('host', {type: 'exit', ...exited, cancelled});
await writeFile(
  `${captureDir}/${scenario}.json`,
  JSON.stringify(records, null, 2),
  {mode: 0o600},
);
await writeFile(`${captureDir}/${scenario}.stderr`, error, {mode: 0o600});
console.log(
  JSON.stringify({
    scenario,
    ...exited,
    is_error: result?.is_error,
    subtype: result?.subtype,
    cancelled,
    records: records.length,
    capturePath: `${captureDir}/${scenario}.json`,
  }),
);
