// Install and exercise the exact packed artifact outside the monorepo. Registry
// access is explicit here, never hidden in the normal native unit test suite.
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const directory = await mkdtemp(join(tmpdir(), 'roomie-distribution-'));
try {
  const tarball = execFileSync(
    process.execPath,
    ['package-distribution.mjs', directory],
    {cwd: new URL('..', import.meta.url), encoding: 'utf8'},
  ).trim();
  execFileSync(
    'npm',
    [
      'install',
      '--prefix',
      directory,
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      tarball,
    ],
    {stdio: 'inherit'},
  );
  const installed = join(directory, 'node_modules/@sqlrooms/roomie-node');
  const manifest = JSON.parse(
    await readFile(join(installed, 'package.json'), 'utf8'),
  );
  if (JSON.stringify(manifest).includes('workspace:'))
    throw Error('Workspace dependency leaked into distribution.');
  execFileSync(
    process.execPath,
    [
      '--test',
      '--test-concurrency=1',
      new URL('launcher.test.mjs', import.meta.url).pathname,
    ],
    {
      cwd: directory,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_PATH: '',
        ROOMIE_LAUNCHER: join(directory, 'node_modules/.bin/roomie-node'),
      },
    },
  );
} finally {
  await rm(directory, {recursive: true, force: true});
}
