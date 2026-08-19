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
const apiPackageNames = apiPackages.map((entry) => entry.name).sort();
const apiPackageCategories = JSON.parse(
  await readFile(
    path.join(siteDir, 'docs', '.vitepress', 'api-packages.json'),
    'utf8',
  ),
);
const catalogPackageNames = apiPackageCategories
  .flatMap((category) => category.packages)
  .map((packageMetadata) => packageMetadata.name)
  .sort();

if (apiPackages.length === 0) {
  throw new Error('The rendered site contains no API package directories');
}

const missingApiDocs = catalogPackageNames.filter(
  (packageName) => !apiPackageNames.includes(packageName),
);
const uncataloguedApiDocs = apiPackageNames.filter(
  (packageName) => !catalogPackageNames.includes(packageName),
);

if (missingApiDocs.length > 0 || uncataloguedApiDocs.length > 0) {
  throw new Error(
    [
      `The API package catalog does not match the rendered API docs.`,
      `Missing docs: ${missingApiDocs.join(', ') || 'none'}.`,
      `Uncatalogued docs: ${uncataloguedApiDocs.join(', ') || 'none'}.`,
    ].join(' '),
  );
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
const packagesPage = await readFile(
  path.join(siteDir, 'docs', '.vitepress', 'dist', 'packages.html'),
  'utf8',
);
const apiPageText = apiPage.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const homePageText = homePage.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const packagesPageText = packagesPage
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ');

if (
  !apiPageText.includes(`API reference for SQLRooms v${metadata.version}`) ||
  !apiPage.includes(metadata.ref)
) {
  throw new Error(
    `The rendered API page does not identify release ${metadata.ref}`,
  );
}

if (
  !homePageText.includes(`API v${metadata.version}`) ||
  !homePage.includes('href="/packages.html"')
) {
  throw new Error(
    `The rendered site navigation does not link API v${metadata.version} to /packages`,
  );
}

if (
  !packagesPageText.includes(
    `API reference for SQLRooms v${metadata.version}`,
  ) ||
  !packagesPage.includes(metadata.ref) ||
  catalogPackageNames.some(
    (packageName) => !packagesPage.includes(`href="/api/${packageName}/"`),
  )
) {
  throw new Error(
    `The rendered package index is incomplete for release ${metadata.ref}`,
  );
}

console.log(
  `Verified ${apiPackages.length} rendered API packages for ${metadata.ref}`,
);
