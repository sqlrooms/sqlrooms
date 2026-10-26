// Trusted per-run process outside the harness namespace and host event loop.
import {spawn} from 'node:child_process';
import {
  readFile,
  readlink,
  writeFile,
  unlink,
  chmod,
  rename,
} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import net from 'node:net';
import {createBroker} from './broker.mjs';

const [record, socketPath] = process.argv.slice(2);
let child,
  closeBroker,
  timer,
  started = false,
  stopping = false,
  ready = false;
const identity = async (pid) => {
  const value = await readFile(`/proc/${pid}/stat`, 'utf8');
  return {pid, start: value.slice(value.lastIndexOf(')') + 2).split(' ')[19]};
};
async function stop(code = 1) {
  if (stopping) return;
  stopping = true;
  clearTimeout(timer);
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL'); // bwrap's parent-death contract kills namespace init and all descendants.
    await new Promise((resolve) => child.once('close', resolve));
  }
  await closeBroker?.();
  await unlink(socketPath).catch(() => {});
  await unlink(record).catch(() => {});
  await unlink(record + '.pending').catch(() => {});
  process.exit(code);
}
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
// Native protocol EOF can be a successful Claude shutdown; FD 3 owns liveness.
process.stdin.on('end', () => {
  if (!started) void stop();
});
process.stdin.on('error', () => void stop());
// A distinct liveness pipe cannot be stalled by backpressure on native stdin.
new net.Socket({fd: 3, readable: true, writable: false})
  .on('end', () => void stop())
  .on('error', () => void stop())
  .resume();
process.stdout.on('error', () => void stop());
let buffer = Buffer.alloc(0);
timer = setTimeout(() => void stop(), 10000);
process.stdin.on('data', async function bootstrap(chunk) {
  buffer = Buffer.concat([buffer, chunk]);
  if (buffer.length > 1024 * 1024) return void stop();
  const end = buffer.indexOf(10);
  if (end < 0) return;
  process.stdin.pause();
  process.stdin.off('data', bootstrap);
  try {
    const config = JSON.parse(buffer.subarray(0, end));
    const status = await readFile('/proc/self/status', 'utf8');
    if (
      !/CapEff:\s+0+\n/.test(status) ||
      !/CapPrm:\s+0+\n/.test(status) ||
      !/CapInh:\s+0+\n/.test(status) ||
      !/CapAmb:\s+0+\n/.test(status) ||
      process.getuid() === 0
    )
      throw Error(
        'Bubblewrap requires an unprivileged host with cleared capabilities.',
      );
    const owner = {
      ...(await identity(process.pid)),
      boot: await readFile('/proc/sys/kernel/random/boot_id', 'utf8'),
      hostNamespace: await readlink('/proc/self/ns/pid'),
      nonce: process.env.ROOMIE_BWRAP_RUN,
    };
    await writeFile(record + '.pending', JSON.stringify(owner), {
      mode: 0o600,
      flag: 'wx',
    });
    await rename(record + '.pending', record);
    clearTimeout(timer);
    timer = setTimeout(() => void stop(124), config.deadlineMs);
    closeBroker = await createBroker({
      socketPath,
      ...config,
      ready: () => ready && !stopping,
    });
    await chmod(socketPath, 0o600);
    if (stopping) return;
    const runtime = config.runtimeDirectory;
    const args = [
      '--unshare-user',
      '--unshare-pid',
      '--unshare-net',
      '--unshare-ipc',
      '--unshare-uts',
      '--new-session',
      '--die-with-parent',
      '--cap-drop',
      'ALL',
      '--info-fd',
      '3',
      '--ro-bind',
      '/usr',
      '/usr',
      '--symlink',
      'usr/bin',
      '/bin',
      '--symlink',
      'usr/lib',
      '/lib',
      '--symlink',
      'usr/lib64',
      '/lib64',
      '--proc',
      '/proc',
      '--dev',
      '/dev',
      '--size',
      '536870912',
      '--tmpfs',
      '/tmp',
      '--size',
      '268435456',
      '--tmpfs',
      '/work',
      '--ro-bind',
      runtime,
      '/runtime',
      '--ro-bind',
      config.cwd,
      '/run-input',
      '--ro-bind',
      socketPath,
      '/gateway/socket',
      '--ro-bind',
      fileURLToPath(new URL('./entry.mjs', import.meta.url)),
      '/entry.mjs',
      '--dir',
      '/etc',
      '--ro-bind',
      '/etc/ssl/certs',
      '/etc/ssl/certs',
      '--clearenv',
      '--setenv',
      'PATH',
      '/runtime/bin:/usr/bin:/bin',
      '--chdir',
      '/work',
      '--remount-ro',
      '/',
      '--',
      '/runtime/bin/node',
      '/entry.mjs',
    ];
    const cpuSeconds = Math.max(1, Math.ceil(config.deadlineMs / 1000));
    child = spawn(
      '/usr/bin/prlimit',
      [
        '--core=0:0',
        '--nofile=1024:1024',
        '--fsize=536870912:536870912',
        `--cpu=${cpuSeconds}:${cpuSeconds}`,
        '--',
        join(runtime, 'bin/bwrap'),
        ...args,
      ],
      {
        stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
        env: {PATH: '/usr/bin:/bin', ROOMIE_BWRAP_RUN: owner.nonce},
      },
    );
    started = true;
    child.once('error', () => void stop());
    child.once('close', (code) => void stop(code ?? 1));
    child.stdin.on('error', () => void stop());
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    const init = await new Promise((resolve, reject) => {
      let info = '';
      child.stdio[3].on('data', (chunk) => {
        info += chunk;
        if (info.length > 4096) reject(Error('Invalid namespace identity'));
        try {
          const pid = JSON.parse(info)['child-pid'];
          if (Number.isSafeInteger(pid) && pid > 1) resolve(pid);
          else reject(Error('Missing namespace identity'));
        } catch {
          /* A JSON frame may span pipe reads. */
        }
      });
      child.stdio[3].once('end', () => {
        try {
          const pid = JSON.parse(info)['child-pid'];
          if (!Number.isSafeInteger(pid) || pid <= 1)
            throw Error('Missing namespace identity');
          resolve(pid);
        } catch (error) {
          reject(error);
        }
      });
      child.once('error', reject);
    });
    const namespace = await identity(init);
    await writeFile(
      record + '.pending',
      JSON.stringify({...owner, namespace}),
      {mode: 0o600},
    );
    await rename(record + '.pending', record);
    if (stopping) return;
    ready = true;
    child.stdin.write(
      JSON.stringify({
        command: config.command,
        args: config.args,
        env: config.env,
      }) + '\n',
    );
    child.stdin.write(buffer.subarray(end + 1));
    buffer = Buffer.alloc(0);
    process.stdin.pipe(child.stdin);
    process.stdin.resume();
  } catch (error) {
    console.error(`Bubblewrap startup: ${error.message}`);
    if (!started) child = undefined;
    await stop();
  }
});
