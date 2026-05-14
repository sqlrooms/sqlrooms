#!/usr/bin/env node
/**
 * Configures npm trusted publishing (OIDC) for all public packages in the monorepo.
 * Each package is linked to the npm-publish.yml GitHub Actions workflow.
 *
 * Prerequisites:
 *   - npm >= 11.10.0  (`npm install -g npm@latest`)
 *   - 2FA enabled on your npm account
 *   - Write access to all @sqlrooms packages
 *
 * Usage:
 *   pnpm setup-trusted-publishing
 *   pnpm setup-trusted-publishing --dry-run
 */
import {spawnSync} from 'node:child_process';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';

const REPO = 'sqlrooms/sqlrooms';
const WORKFLOW_FILE = 'npm-publish.yml';
const DELAY_MS = 2000;
const MIN_NPM_VERSION = '11.10.0';

const npmVersion = spawnSync('npm', ['--version'], {encoding: 'utf-8'})
  .stdout?.trim();
if (
  !npmVersion ||
  npmVersion.localeCompare(MIN_NPM_VERSION, undefined, {numeric: true}) < 0
) {
  console.error(
    `npm >= ${MIN_NPM_VERSION} is required (found ${npmVersion || 'none'}).` +
      `\nRun: npm install -g npm@latest`,
  );
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');
const packagesDir = join(import.meta.dirname, '..', 'packages');

const dirs = readdirSync(packagesDir, {withFileTypes: true})
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const packages = [];
for (const dir of dirs) {
  const pkgPath = join(packagesDir, dir, 'package.json');
  if (!existsSync(pkgPath)) continue;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  if (pkg.private) continue;
  packages.push({name: pkg.name, version: pkg.version, dir});
}

console.log(
  `Found ${packages.length} public packages to configure.\n` +
    `Repository: ${REPO}\n` +
    `Workflow:   ${WORKFLOW_FILE}\n` +
    (dryRun ? '(dry run — no changes will be made)\n' : ''),
);

function hasTrust(name) {
  const result = spawnSync('npm', ['trust', 'list', name, '--json'], {
    encoding: 'utf-8',
    shell: false,
    env: process.env,
  });
  if (result.status !== 0) return false;
  try {
    const data = JSON.parse(result.stdout);
    return Array.isArray(data) ? data.length > 0 : Boolean(data);
  } catch {
    return false;
  }
}

const configured = [];
const alreadySetUp = [];
const notFound = [];
const errored = [];

for (let i = 0; i < packages.length; i++) {
  const {name, version, dir} = packages[i];
  process.stdout.write(`[${i + 1}/${packages.length}] ${name}`);

  if (hasTrust(name)) {
    console.log(' — already configured, skipping');
    alreadySetUp.push(name);
    continue;
  }

  console.log();

  const args = [
    'trust',
    'github',
    name,
    '--repo',
    REPO,
    '--file',
    WORKFLOW_FILE,
    '--yes',
  ];
  if (dryRun) args.push('--dry-run');

  const result = spawnSync('npm', args, {
    stdio: ['inherit', 'inherit', 'pipe'],
    shell: false,
    env: process.env,
    encoding: 'utf-8',
  });

  if (result.status !== 0) {
    if (result.stderr?.includes('E404')) {
      notFound.push({name, version, dir});
    } else {
      if (result.stderr) process.stderr.write(result.stderr);
      errored.push(name);
    }
  } else {
    configured.push(name);
  }

  if (i < packages.length - 1) {
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }
}

console.log(`\n${'—'.repeat(60)}`);
console.log(`Summary: ${packages.length} packages\n`);

if (configured.length) {
  console.log(`  ✔ Configured (${configured.length}):`);
  configured.forEach((n) => console.log(`    ${n}`));
}

if (alreadySetUp.length) {
  console.log(`  ● Already set up (${alreadySetUp.length}):`);
  alreadySetUp.forEach((n) => console.log(`    ${n}`));
}

if (notFound.length) {
  console.log(`\n  ✗ Not found on npm (${notFound.length}):`);
  console.log(`    Publish manually first, then re-run this script:\n`);
  notFound.forEach(({name, version, dir}) => {
    const isPrerelease = version.includes('-');
    const tagFlag = isPrerelease ? ' --tag next' : '';
    console.log(`    cd packages/${dir} && npm publish --access public${tagFlag}`);
  });
}

if (errored.length) {
  console.log(`\n  ✗ Failed (${errored.length}):`);
  errored.forEach((n) => console.log(`    ${n}`));
}

console.log();
if (notFound.length || errored.length) process.exit(1);
