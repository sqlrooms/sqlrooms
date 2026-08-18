import {readFile, readdir} from 'node:fs/promises';
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

const args = readArguments(process.argv.slice(2));
const siteDir = path.resolve(args.get('site') || 'site');
const metadata = JSON.parse(
  await readFile(
    path.join(siteDir, 'docs', '.vitepress', 'api-release.generated.json'),
    'utf8',
  ),
);
const apiDistDir = path.join(siteDir, 'docs', '.vitepress', 'dist', 'api');
const apiPackages = (await readdir(apiDistDir, {withFileTypes: true})).filter(
  (entry) => entry.isDirectory(),
);

if (apiPackages.length === 0) {
  throw new Error('The rendered site contains no API package directories');
}

const representativePackage = apiPackages.find(
  (entry) => entry.name === 'duckdb',
)?.name;

if (!representativePackage) {
  throw new Error('The rendered site is missing the @sqlrooms/duckdb API docs');
}

const apiPage = await readFile(
  path.join(apiDistDir, representativePackage, 'index.html'),
  'utf8',
);
const homePage = await readFile(
  path.join(siteDir, 'docs', '.vitepress', 'dist', 'index.html'),
  'utf8',
);
const apiPageText = apiPage.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const homePageText = homePage.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

if (
  !apiPageText.includes(`API reference for SQLRooms v${metadata.version}`) ||
  !apiPage.includes(metadata.ref)
) {
  throw new Error(
    `The rendered API page does not identify release ${metadata.ref}`,
  );
}

if (!homePageText.includes(`API v${metadata.version}`)) {
  throw new Error(
    `The rendered site navigation does not show API v${metadata.version}`,
  );
}

console.log(
  `Verified ${apiPackages.length} rendered API packages for ${metadata.ref}`,
);
