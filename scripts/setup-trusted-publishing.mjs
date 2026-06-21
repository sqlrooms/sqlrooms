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
 *   pnpm setup-trusted-publishing @sqlrooms/data-table @sqlrooms/duckdb
 *   pnpm setup-trusted-publishing --dry-run
 *   pnpm setup-trusted-publishing --dry-run @sqlrooms/data-table
 */
import {spawnSync} from 'node:child_process';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';

const REPO = 'sqlrooms/sqlrooms';
const WORKFLOW_FILE = 'npm-publish.yml';
const DELAY_MS = 2000;
const MIN_NPM_VERSION = '11.10.0';
const TRUST_LIST_TIMEOUT_MS = 30_000;

const npmVersion = spawnSync('npm', ['--version'], {
  encoding: 'utf-8',
}).stdout?.trim();
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

const rawArgs = process.argv.slice(2);
const dryRun = rawArgs.includes('--dry-run');
const selectedPackages = rawArgs.filter(
  (arg) => arg !== '--dry-run' && arg !== '--',
);
const unknownOptions = selectedPackages.filter((arg) => arg.startsWith('-'));

if (unknownOptions.length) {
  console.error(`Unknown option(s): ${unknownOptions.join(', ')}`);
  process.exit(1);
}

const packagesDir = join(import.meta.dirname, '..', 'packages');

const dirs = readdirSync(packagesDir, {withFileTypes: true})
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const allPackages = [];
for (const dir of dirs) {
  const pkgPath = join(packagesDir, dir, 'package.json');
  if (!existsSync(pkgPath)) continue;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  if (pkg.private) continue;
  allPackages.push({name: pkg.name, version: pkg.version, dir});
}

const selectedPackageSet = new Set(selectedPackages);
const packages = selectedPackageSet.size
  ? allPackages.filter(
      ({name, dir}) =>
        selectedPackageSet.has(name) || selectedPackageSet.has(dir),
    )
  : allPackages;

const matchedSelections = new Set(
  packages.flatMap(({name, dir}) => [
    ...(selectedPackageSet.has(name) ? [name] : []),
    ...(selectedPackageSet.has(dir) ? [dir] : []),
  ]),
);
const unmatchedSelections = selectedPackages.filter(
  (name) => !matchedSelections.has(name),
);

if (unmatchedSelections.length) {
  console.error(
    `Package(s) not found in packages/: ${unmatchedSelections.join(', ')}`,
  );
  process.exit(1);
}

const trustHelp = spawnSync('npm', ['help', 'trust'], {
  encoding: 'utf-8',
}).stdout;
if (!trustHelp?.includes('--allow-publish')) {
  console.error(
    `npm trust must support --allow-publish (found npm ${npmVersion}).` +
      `\nRun: npm install -g npm@latest`,
  );
  process.exit(1);
}

console.log(
  `Found ${packages.length} public package${
    packages.length === 1 ? '' : 's'
  } to configure.\n` +
    `Repository: ${REPO}\n` +
    `Workflow:   ${WORKFLOW_FILE}\n` +
    (selectedPackageSet.size
      ? `Selected:   ${packages.map(({name}) => name).join(', ')}\n`
      : '') +
    (dryRun ? '(dry run — no changes will be made)\n' : ''),
);

function hasTrust(name) {
  const result = spawnSync('npm', ['trust', 'list', name, '--json'], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    env: process.env,
    timeout: TRUST_LIST_TIMEOUT_MS,
  });
  if (result.error) {
    console.warn(
      `Unable to check existing trusted publishing config for ${name}: ${result.error.message}`,
    );
    return false;
  }
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

function summarizeNpmError(stderr) {
  const lines = stderr
    ?.split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    lines?.find((line) => line.startsWith('npm error 400 ')) ??
    lines?.find((line) => line.startsWith('npm error ')) ??
    null
  );
}

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
    '--allow-publish',
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
      errored.push({name, error: summarizeNpmError(result.stderr)});
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
  console.log(
    `    Bootstrap each package manually, configure trusted publishing,` +
      ` then verify it:\n`,
  );
  notFound.forEach(({name, version, dir}) => {
    const isPrerelease = version.includes('-');
    const tagFlag = isPrerelease ? ' --tag next' : '';
    console.log(`    # ${name}`);
    console.log(
      `    cd packages/${dir} && npm publish --access public${tagFlag}`,
    );
    console.log(
      `    npm trust github ${name} --repo ${REPO} --file ${WORKFLOW_FILE} --yes`,
    );
    console.log(`    npm trust list ${name}`);
    console.log();
  });
}

if (errored.length) {
  console.log(`\n  ✗ Failed (${errored.length}):`);
  errored.forEach(({name, error}) => {
    console.log(`    ${name}${error ? ` — ${error}` : ''}`);
  });
}

console.log();
if (notFound.length || errored.length) process.exit(1);
