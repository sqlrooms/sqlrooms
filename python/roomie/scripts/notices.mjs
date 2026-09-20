import {readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

/** Include license texts for the installed frontend dependency closure. */
export function writeNotices(repo, target) {
  const result = spawnSync(
    'pnpm',
    ['--filter', 'roomie-cli-app', 'licenses', 'list', '--prod', '--json'],
    {cwd: repo, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024},
  );
  if (result.status !== 0)
    throw new Error(result.stderr || 'Dependency license collection failed.');
  const licenses = JSON.parse(result.stdout);
  const entries = Object.values(licenses)
    .flat()
    .sort((a, b) => a.name.localeCompare(b.name));
  const sections = [
    'Roomie frontend third-party notices\n\nIncludes the installed frontend dependency closure; some dependencies are tree-shaken from the bundle.\nSQLRooms packages are Copyright SQLRooms Contributors, MIT. See NOTICE.',
  ];
  for (const entry of entries) {
    sections.push(
      `${entry.name} ${entry.versions.join(', ')}\nLicense: ${entry.license}\n${entry.homepage || entry.repository || ''}`,
    );
    const texts = new Set();
    for (const directory of entry.paths ?? []) {
      for (const file of readdirSync(directory).filter((file) =>
        /^(licen[cs]e|notice|copying)(\.|$)/i.test(file),
      )) {
        const full = path.join(directory, file);
        if (statSync(full).isFile()) texts.add(readFileSync(full, 'utf8'));
      }
    }
    sections.push(...texts);
  }
  writeFileSync(
    target,
    sections.join('\n\n----------------------------------------\n\n') + '\n',
  );
}
