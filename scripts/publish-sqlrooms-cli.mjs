#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packages = [
  {
    label: 'sqlrooms-server',
    cwd: resolve(rootDir, 'python/sqlrooms-server'),
  },
  {
    label: 'sqlrooms',
    cwd: resolve(rootDir, 'python/sqlrooms'),
  },
];

const args = new Set(process.argv.slice(2));

if (args.has('--help') || args.has('-h')) {
  console.log(`Publish the SQLRooms Python CLI packages in dependency order.

Usage:
  pnpm publish-cli [--check-only] [--skip-checks]

Options:
  --check-only   Run prerelease checks only; do not upload packages.
  --skip-checks  Upload packages without running prerelease checks first.
`);
  process.exit(0);
}

const unknownArgs = [...args].filter(
  (arg) => arg !== '--check-only' && arg !== '--skip-checks',
);

if (unknownArgs.length > 0) {
  console.error(`Unknown option: ${unknownArgs.join(', ')}`);
  process.exit(1);
}

if (args.has('--check-only') && args.has('--skip-checks')) {
  console.error('Use either --check-only or --skip-checks, not both.');
  process.exit(1);
}

const run = (label, cwd, script) => {
  console.log(`\n==> ${label}: pnpm ${script}`);
  const result = spawnSync('pnpm', [script], {
    cwd,
    env: process.env,
    shell: false,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

if (!args.has('--skip-checks')) {
  for (const pkg of packages) {
    run(pkg.label, pkg.cwd, 'prerelease');
  }
}

if (args.has('--check-only')) {
  console.log('\nSQLRooms CLI prerelease checks passed.');
  process.exit(0);
}

for (const pkg of packages) {
  run(pkg.label, pkg.cwd, 'release');
}

console.log('\nSQLRooms CLI packages published.');
