// Build first with `pnpm exec turbo build --filter=roomie-node`.
// Stage only runtime files; never ship workspace links, tests, or local state.
import {cp, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {writeNotices} from '../../python/roomie/scripts/notices.mjs';
const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(process.argv[2] ?? join(root, 'release'));
const source = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const dependencies = {};
for (const name of Object.keys(source.dependencies).filter(
  (name) => !name.startsWith('@sqlrooms/'),
)) {
  const pkg = JSON.parse(
    await readFile(join(root, 'node_modules', name, 'package.json'), 'utf8'),
  );
  if (pkg.name !== name) throw Error(`Unexpected installed dependency ${name}`);
  dependencies[name] = pkg.version;
}
const stage = await mkdtemp(join(tmpdir(), 'roomie-package-'));
try {
  await cp(join(root, 'dist'), join(stage, 'dist'), {recursive: true});
  await cp(join(root, 'bin'), join(stage, 'bin'), {recursive: true});
  await cp(join(root, 'service'), join(stage, 'service'), {recursive: true});
  await cp(join(root, 'bubblewrap'), join(stage, 'bubblewrap'), {
    recursive: true,
  });
  await cp(join(root, 'container'), join(stage, 'container'), {
    recursive: true,
    filter: (path) => !path.endsWith('Dockerfile.test'),
  });
  await cp(join(root, 'README.md'), join(stage, 'README.md'));
  await cp(join(root, '../../LICENSE.md'), join(stage, 'LICENSE'));
  await cp(join(root, '../../LICENSE.md'), join(stage, 'NOTICE'));
  writeNotices(resolve(root, '../..'), join(stage, 'THIRD_PARTY_NOTICES.txt'));
  await writeFile(
    join(stage, 'package.json'),
    JSON.stringify(
      {
        name: '@sqlrooms/roomie-node',
        version: '0.0.0-m4.0',
        private: true,
        description: 'Local Roomie workspace host (draft distribution)',
        license: 'MIT',
        type: 'module',
        bin: {'roomie-node': 'bin/roomie-node.mjs'},
        engines: source.engines,
        os: ['darwin', 'linux'],
        files: [
          'bin',
          'service',
          'bubblewrap',
          'dist',
          'container',
          'README.md',
          'LICENSE',
          'NOTICE',
          'THIRD_PARTY_NOTICES.txt',
        ],
        dependencies,
      },
      null,
      2,
    ) + '\n',
  );
  await mkdir(output, {recursive: true});
  const packed = JSON.parse(
    execFileSync(
      'npm',
      ['pack', '--json', '--ignore-scripts', '--pack-destination', output],
      {cwd: stage, encoding: 'utf8'},
    ),
  );
  console.log(join(output, packed[0].filename));
} finally {
  await rm(stage, {recursive: true, force: true});
}
