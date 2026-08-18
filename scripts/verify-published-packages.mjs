import {execFile} from 'node:child_process';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {promisify} from 'node:util';

const execFileAsync = promisify(execFile);
const requestedVersion = process.argv[2];
const registry = 'https://registry.npmjs.org/';
const attempts = 8;
const batchSize = 8;

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function getPublicPackages() {
  const packagesDir = path.resolve('packages');
  const entries = await readdir(packagesDir, {withFileTypes: true});
  const packageNames = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    try {
      const packageJson = await readJson(
        path.join(packagesDir, entry.name, 'package.json'),
      );

      if (packageJson.name?.startsWith('@sqlrooms/') && !packageJson.private) {
        packageNames.push(packageJson.name);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return packageNames.sort();
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function verifyPackage(packageName, version) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const {stdout} = await execFileAsync(
        'npm',
        [
          'view',
          `${packageName}@${version}`,
          'version',
          '--json',
          `--registry=${registry}`,
        ],
        {encoding: 'utf8'},
      );
      const publishedVersion = JSON.parse(stdout);

      if (publishedVersion === version) {
        console.log(`Verified ${packageName}@${version}`);
        return;
      }

      lastError = new Error(
        `npm returned ${JSON.stringify(publishedVersion)} instead of ${version}`,
      );
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts) {
      await wait(attempt * 2_000);
    }
  }

  throw new Error(
    `Could not verify ${packageName}@${version}: ${lastError?.message}`,
  );
}

const lernaConfig = await readJson(path.resolve('lerna.json'));

if (!requestedVersion) {
  throw new Error('Usage: verify-published-packages.mjs <version>');
}

if (requestedVersion !== lernaConfig.version) {
  throw new Error(
    `Requested version ${requestedVersion} does not match lerna.json version ${lernaConfig.version}`,
  );
}

const packageNames = await getPublicPackages();

for (let index = 0; index < packageNames.length; index += batchSize) {
  await Promise.all(
    packageNames
      .slice(index, index + batchSize)
      .map((packageName) => verifyPackage(packageName, requestedVersion)),
  );
}

console.log(
  `Verified ${packageNames.length} public packages at ${requestedVersion}`,
);
