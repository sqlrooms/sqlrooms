import {cp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';

function readArguments(argv) {
  const argumentsByName = new Map();

  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];

    if (!name?.startsWith('--') || !value) {
      throw new Error(`Invalid argument near ${name || '<end>'}`);
    }

    argumentsByName.set(name.slice(2), value);
  }

  return argumentsByName;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function getPublicPackages(apiSourceDir) {
  const packagesDir = path.join(apiSourceDir, 'packages');
  const entries = await readdir(packagesDir, {withFileTypes: true});
  const packages = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    try {
      const packageJson = await readJson(
        path.join(packagesDir, entry.name, 'package.json'),
      );

      if (packageJson.name?.startsWith('@sqlrooms/') && !packageJson.private) {
        packages.push(packageJson);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return packages;
}

const args = readArguments(process.argv.slice(2));
const siteDir = path.resolve(args.get('site') || 'site');
const apiSourceDir = path.resolve(args.get('api-source') || 'api-source');
const apiRef = args.get('api-ref');

if (!apiRef) {
  throw new Error('--api-ref is required');
}

const lernaConfig = await readJson(path.join(apiSourceDir, 'lerna.json'));
const version = lernaConfig.version;
const expectedRef = `v${version}`;

if (apiRef !== expectedRef) {
  throw new Error(
    `API ref ${apiRef} does not match the source version ${expectedRef}`,
  );
}

const publicPackages = await getPublicPackages(apiSourceDir);
const mismatchedPackages = publicPackages.filter(
  (packageJson) => packageJson.version !== version,
);

if (publicPackages.length === 0) {
  throw new Error('No public @sqlrooms packages were found in the API source');
}

if (mismatchedPackages.length > 0) {
  throw new Error(
    `Packages do not match ${version}: ${mismatchedPackages
      .map((packageJson) => `${packageJson.name}@${packageJson.version}`)
      .join(', ')}`,
  );
}

const generatedApiDir = path.join(apiSourceDir, 'docs', 'api');
const siteApiDir = path.join(siteDir, 'docs', 'api');
const metadataPath = path.join(
  siteDir,
  'docs',
  '.vitepress',
  'api-release.generated.json',
);
const metadata = {
  version,
  ref: apiRef,
  prerelease: version.includes('-'),
};

await rm(siteApiDir, {recursive: true, force: true});
await cp(generatedApiDir, siteApiDir, {recursive: true});
await mkdir(path.dirname(metadataPath), {recursive: true});
await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

console.log(
  `Assembled API documentation for ${apiRef} (${publicPackages.length} public packages)`,
);
