import assert from 'node:assert/strict';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

test(
  'the root CLI separator reaches uv with a dash-prefixed database path',
  {skip: process.platform === 'win32'},
  (t) => {
    const testDir = mkdtempSync(path.join(tmpdir(), 'sqlrooms-dev-test-'));
    const capturePath = path.join(testDir, 'args.json');
    const fakeUvPath = path.join(testDir, 'uv');
    t.after(() => rmSync(testDir, {force: true, recursive: true}));

    writeFileSync(
      fakeUvPath,
      "#!/usr/bin/env node\nrequire('node:fs').writeFileSync(process.env.SQLROOMS_TEST_CAPTURE_PATH, JSON.stringify(process.argv.slice(2)));\n",
    );
    chmodSync(fakeUvPath, 0o755);

    const result = spawnSync(process.execPath, ['scripts/dev.mjs'], {
      cwd: path.resolve(import.meta.dirname, '..'),
      env: {
        ...process.env,
        PATH: `${testDir}${path.delimiter}${process.env.PATH ?? ''}`,
        SQLROOMS_CLI_DEV_ARGS: JSON.stringify(['--', '-dev.db']),
        SQLROOMS_TEST_CAPTURE_PATH: capturePath,
      },
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    const uvArgs = JSON.parse(readFileSync(capturePath, 'utf8'));
    const separatorIndex = uvArgs.lastIndexOf('--');
    assert.notEqual(separatorIndex, -1);
    assert.deepEqual(uvArgs.slice(separatorIndex), ['--', '-dev.db']);
  },
);
