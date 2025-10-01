#!/usr/bin/env node
import {spawnSync} from 'node:child_process';

const preid =
  process.env.PREID && process.env.PREID.trim()
    ? process.env.PREID.trim()
    : 'rc';

const result = spawnSync(
  'pnpm',
  [
    'exec',
    'lerna',
    'version',
    'prerelease',
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

