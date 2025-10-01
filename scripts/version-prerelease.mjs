#!/usr/bin/env node
import {spawnSync} from 'node:child_process';

const preid =
  process.env.PREID && process.env.PREID.trim()
    ? process.env.PREID.trim()
    : 'rc';

const prereleaseBump =
  process.env.PRERELEASE_BUMP && process.env.PRERELEASE_BUMP.trim()
    ? process.env.PRERELEASE_BUMP.trim()
    : 'patch';

const bumpCommand =
  prereleaseBump === 'minor'
    ? 'preminor'
    : prereleaseBump === 'major'
      ? 'premajor'
      : 'prerelease';

const result = spawnSync(
  'pnpm',
  [
    'exec',
    'lerna',
    'version',
    bumpCommand,
    '--conventional-commits',
    '--yes',
    '--sync-workspace-lock',
    `--preid=${preid}`,
  ],
  {
    stdio: 'inherit',
    shell: false,
    env: process.env,
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
