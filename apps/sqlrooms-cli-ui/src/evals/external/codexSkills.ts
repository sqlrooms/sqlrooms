import {access, readdir, realpath} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';

/** Finds local skill files to disable for this invocation without changing user settings or copying credentials. */
export async function findOtherCodexSkills(): Promise<string[]> {
  const codexDirectory =
    process.env.CODEX_HOME ?? path.join(homedir(), '.codex');
  const roots = [
    path.join(homedir(), '.agents/skills'),
    path.join(codexDirectory, 'skills'),
    path.join(codexDirectory, 'plugins/cache'),
    '/etc/codex/skills',
  ];
  const visited = new Set<string>();
  const skills = new Set<string>();
  const visit = async (directory: string): Promise<void> => {
    let resolved: string;
    try {
      resolved = await realpath(directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    if (visited.has(resolved)) return;
    visited.add(resolved);
    const skill = path.join(resolved, 'SKILL.md');
    try {
      await access(skill);
      skills.add(skill);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    for (const entry of await readdir(resolved, {withFileTypes: true})) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      if (entry.isDirectory()) await visit(path.join(resolved, entry.name));
      else if (entry.isSymbolicLink()) {
        const target = await realpath(path.join(resolved, entry.name));
        const {stat} = await import('node:fs/promises');
        if ((await stat(target)).isDirectory()) await visit(target);
      }
    }
  };
  for (const root of roots) await visit(root);
  return [...skills].sort();
}
