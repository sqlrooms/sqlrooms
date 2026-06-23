#!/usr/bin/env node
import {readFileSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const packagesByTarget = {
  'sqlrooms-server': {
    label: 'sqlrooms-server',
    cwd: resolve(rootDir, 'python/sqlrooms-server'),
    packageJson: resolve(rootDir, 'python/sqlrooms-server/package.json'),
    uploadArgs: ['twine', 'upload', '--skip-existing', '../dist/sqlrooms_server*'],
  },
  sqlrooms: {
    label: 'sqlrooms',
    cwd: resolve(rootDir, 'python/sqlrooms'),
    packageJson: resolve(rootDir, 'python/sqlrooms/package.json'),
    uploadArgs: ['twine', 'upload', '--skip-existing', '../dist/sqlrooms-*'],
  },
};

const dependencyOrder = ['sqlrooms-server', 'sqlrooms'];
const sqlroomsPyproject = resolve(rootDir, 'python/sqlrooms/pyproject.toml');

const usage = () => {
  console.log(`Manage SQLRooms Python CLI package releases.

Usage:
  pnpm cli:version --target <sqlrooms|sqlrooms-server|all> --bump <patch|minor|major>
  pnpm cli:version --target <sqlrooms|sqlrooms-server|all> --set <version>
  pnpm cli:publish [--target <sqlrooms|sqlrooms-server|all>]
  pnpm cli:publish:dry [--target <sqlrooms|sqlrooms-server|all>]

Compatibility:
  pnpm publish-cli
  pnpm publish-cli:check

Options:
  --target <target>  Package to operate on. Defaults to all.
  --bump <level>     Explicitly bump patch, minor, or major.
  --set <version>    Explicitly set the version.
  --dry-run          Run publish validation/build steps without uploading.
`);
};

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const parseArgs = (argv) => {
  const parsed = {
    command: undefined,
    target: 'all',
    bump: undefined,
    setVersion: undefined,
    dryRun: false,
    help: false,
  };

  const args = argv.filter((arg) => arg !== '--');
  if (args[0] === 'version' || args[0] === 'publish') {
    parsed.command = args.shift();
  }

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--target') {
      parsed.target = args[++i];
    } else if (arg.startsWith('--target=')) {
      parsed.target = arg.slice('--target='.length);
    } else if (arg === '--bump') {
      parsed.bump = args[++i];
    } else if (arg.startsWith('--bump=')) {
      parsed.bump = arg.slice('--bump='.length);
    } else if (arg === '--set') {
      parsed.setVersion = args[++i];
    } else if (arg.startsWith('--set=')) {
      parsed.setVersion = arg.slice('--set='.length);
    } else if (arg === '--dry-run' || arg === '--check-only') {
      parsed.dryRun = true;
    } else {
      fail(`Unknown option: ${arg}`);
    }
  }

  parsed.command ??= 'publish';
  return parsed;
};

const getTargets = (target) => {
  if (target === 'all') {
    return dependencyOrder;
  }

  if (Object.hasOwn(packagesByTarget, target)) {
    return [target];
  }

  fail(`Unknown target: ${target}. Use sqlrooms, sqlrooms-server, or all.`);
};

const readPackageJson = (target) =>
  JSON.parse(readFileSync(packagesByTarget[target].packageJson, 'utf8'));

const writePackageVersion = (target, version) => {
  const pkgPath = packagesByTarget[target].packageJson;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.version = version;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
};

const versionPattern = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const stableVersionPattern = /^\d+\.\d+\.\d+$/;

const bumpVersion = (version, level) => {
  if (!stableVersionPattern.test(version)) {
    fail(`Cannot bump non-stable version ${version}. Use --set instead.`);
  }

  const [major, minor, patch] = version.split('.').map(Number);
  if (level === 'major') {
    return `${major + 1}.0.0`;
  }
  if (level === 'minor') {
    return `${major}.${minor + 1}.0`;
  }
  if (level === 'patch') {
    return `${major}.${minor}.${patch + 1}`;
  }

  fail(`Unknown bump level: ${level}. Use patch, minor, or major.`);
};

const updateServerDependencyFloor = (version) => {
  const pyproject = readFileSync(sqlroomsPyproject, 'utf8');
  const dependencyPattern = /"sqlrooms-server>=([^"]+)"/;
  if (!dependencyPattern.test(pyproject)) {
    fail('Could not find sqlrooms-server dependency floor in python/sqlrooms/pyproject.toml.');
  }

  const updated = pyproject.replace(
    dependencyPattern,
    `"sqlrooms-server>=${version}"`,
  );

  writeFileSync(sqlroomsPyproject, updated);
};

const run = (label, cwd, command, args) => {
  console.log(`\n==> ${label}: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    shell: false,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const versionPackages = ({target, bump, setVersion}) => {
  if (bump && setVersion) {
    fail('Use either --bump or --set, not both.');
  }
  if (!bump && !setVersion) {
    fail('Versioning is explicit. Pass --bump patch|minor|major or --set <version>.');
  }
  if (setVersion && !versionPattern.test(setVersion)) {
    fail(`Invalid version: ${setVersion}`);
  }

  const targets = getTargets(target);
  let serverVersion;

  for (const packageTarget of targets) {
    const pkg = readPackageJson(packageTarget);
    const nextVersion = setVersion ?? bumpVersion(pkg.version, bump);
    writePackageVersion(packageTarget, nextVersion);
    console.log(`${packagesByTarget[packageTarget].label}: ${pkg.version} -> ${nextVersion}`);

    if (packageTarget === 'sqlrooms-server') {
      serverVersion = nextVersion;
    }
  }

  if (serverVersion) {
    updateServerDependencyFloor(serverVersion);
    console.log(`sqlrooms dependency floor: sqlrooms-server>=${serverVersion}`);
  }
};

const publishPackages = ({target, dryRun}) => {
  const targets = getTargets(target);

  for (const packageTarget of targets) {
    const pkg = packagesByTarget[packageTarget];
    run(pkg.label, pkg.cwd, 'pnpm', ['prerelease']);
  }

  if (dryRun) {
    console.log('\nSQLRooms CLI publish dry run passed. No packages were uploaded.');
    return;
  }

  for (const packageTarget of targets) {
    const pkg = packagesByTarget[packageTarget];
    run(pkg.label, pkg.cwd, 'uvx', pkg.uploadArgs);
  }

  console.log('\nSQLRooms CLI packages published.');
};

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  usage();
  process.exit(0);
}

if (args.command === 'version') {
  versionPackages(args);
} else if (args.command === 'publish') {
  publishPackages(args);
} else {
  fail(`Unknown command: ${args.command}`);
}
