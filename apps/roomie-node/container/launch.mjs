// One private bootstrap frame, then transparent native protocol stdio.
import {spawn} from 'node:child_process';
import {mkdir, cp} from 'node:fs/promises';
let input = Buffer.alloc(0);
process.stdin.on('data', async function bootstrap(chunk) {
  input = Buffer.concat([input, chunk]);
  if (input.length > 1024 * 1024) process.exit(1);
  const end = input.indexOf(10);
  if (end < 0) return;
  process.stdin.pause();
  process.stdin.removeListener('data', bootstrap);
  const config = JSON.parse(input.subarray(0, end).toString());
  setTimeout(() => process.exit(124), Math.min(config.deadlineMs, 3600000));
  await mkdir('/tmp/home', {recursive: true});
  await cp('/run-input', '/work', {recursive: true, dereference: false});
  const env = {
    PATH: process.env.PATH,
    HOME: '/tmp/home',
    TMPDIR: '/tmp',
    ...config.env,
  };
  if (config.command === 'codex' && env.OPENAI_API_KEY) {
    // Use the vendor's supported login command; only this explicitly delegated
    // API key is written into the disposable home, never host account files.
    await new Promise((resolve, reject) => {
      const login = spawn('codex', ['login', '--with-api-key'], {
        env,
        stdio: ['pipe', 'ignore', 'ignore'],
      });
      login.on('error', reject);
      login.on('exit', (code) =>
        code === 0 ? resolve() : reject(new Error('Model login failed')),
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
  child.on('error', () => process.exit(1));
  child.on('exit', (code) => process.exit(code ?? 1));
  child.stdin.on('error', () => {});
  child.stdin.write(input.subarray(end + 1));
  input = Buffer.alloc(0);
  process.stdin.pipe(child.stdin);
  process.stdin.resume();
});
