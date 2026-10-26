// Runs entirely inside the filesystem/PID/network boundary. Never trusted for cleanup.
import net from 'node:net';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdir, cp} from 'node:fs/promises';
const proxy = net.createServer((client) => {
  const upstream = net.connect('/gateway/socket');
  client.on('error', () => upstream.destroy());
  upstream.on('error', () => client.destroy());
  client.once('close', () => upstream.destroy());
  upstream.once('close', () => client.destroy());
  client.pipe(upstream).pipe(client);
});
await new Promise((resolve, reject) => {
  proxy.once('error', reject);
  proxy.listen(43100, '127.0.0.1', resolve);
});
let buffer = Buffer.alloc(0);
let received = false;
process.stdin.on('end', () => {
  if (!received) process.exit(1);
});
process.stdin.on('data', async function bootstrap(chunk) {
  buffer = Buffer.concat([buffer, chunk]);
  if (buffer.length > 1024 * 1024) process.exit(1);
  const end = buffer.indexOf(10);
  if (end < 0) return;
  process.stdin.pause();
  process.stdin.off('data', bootstrap);
  try {
    const config = JSON.parse(buffer.subarray(0, end));
    // Only a live trusted runner can authorize startup after bwrap armed its
    // parent-death handling and the namespace identity was recorded.
    await new Promise((resolve, reject) => {
      const request = http.get(
        'http://127.0.0.1:43100/__roomie_ready',
        {timeout: 3000},
        (response) => {
          response.resume();
          response.statusCode === 204
            ? resolve()
            : reject(Error('Runner unavailable'));
        },
      );
      request.on('error', reject);
      request.on('timeout', () => request.destroy(Error('Runner unavailable')));
    });
    received = true;
    await mkdir('/tmp/home', {recursive: true});
    await cp('/run-input', '/work', {recursive: true, dereference: false});
    const env = {
      PATH: '/runtime/bin:/usr/bin:/bin',
      HOME: '/tmp/home',
      TMPDIR: '/tmp',
      HTTP_PROXY: 'http://127.0.0.1:43100',
      HTTPS_PROXY: 'http://127.0.0.1:43100',
      http_proxy: 'http://127.0.0.1:43100',
      https_proxy: 'http://127.0.0.1:43100',
      NO_PROXY: '',
      no_proxy: '',
      NODE_USE_ENV_PROXY: '1',
      ...config.env,
    };
    if (config.command === 'codex' && env.OPENAI_API_KEY) {
      await new Promise((resolve, reject) => {
        const login = spawn('codex', ['login', '--with-api-key'], {
          env,
          stdio: ['pipe', 'ignore', 'ignore'],
        });
        login.once('error', reject);
        login.once('exit', (code) =>
          code === 0 ? resolve() : reject(Error('Model login failed')),
        );
        login.stdin.on('error', reject);
        login.stdin.end(env.OPENAI_API_KEY + '\n');
      });
    }
    const child = spawn(config.command, config.args, {
      cwd: '/work',
      env,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    child.once('error', () => process.exit(1));
    child.once('exit', (code) => process.exit(code ?? 1));
    child.stdin.on('error', () => {});
    child.stdin.write(buffer.subarray(end + 1));
    buffer = Buffer.alloc(0);
    process.stdin.pipe(child.stdin);
    process.stdin.resume();
  } catch {
    process.exit(1);
  }
});
