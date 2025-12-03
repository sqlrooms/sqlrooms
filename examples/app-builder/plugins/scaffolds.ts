import type {Plugin} from 'vite';
import * as path from 'path';
import {fileURLToPath} from 'node:url';
import {generateScaffoldsModule} from './generateScaffolds';

/**
 * Vite plugin that generates the FileSystemTree module for app scaffolds and
 * watches for changes during dev.
 */
export default function scaffoldsPlugin(): Plugin {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const exampleRoot = path.resolve(__dirname, '..');
  const scaffoldsRoot = path.join(exampleRoot, 'app-scaffolds');
  const outputFile = path.join(scaffoldsRoot, 'scaffolds.generated.json');

  async function runGenerate() {
    await generateScaffoldsModule({
      scaffoldsRootDir: scaffoldsRoot,
      outputFile,
    });
  }

  return {
    name: 'sqlrooms-scaffolds',
    apply: 'serve',
    async buildStart() {
      await runGenerate();
    },
    configureServer(server) {
      // Initial generate already happened in buildStart; also regenerate on changes.
      const watcher = server.watcher;
      watcher.add(scaffoldsRoot);
      const onFsEvent = async (changedPath: string) => {
        // Ignore changes outside scaffolds root or to the generated output file
        if (!changedPath.startsWith(scaffoldsRoot)) return;
        if (changedPath === outputFile) return;
        await runGenerate();
      };
      watcher.on('add', onFsEvent);
      watcher.on('change', onFsEvent);
      watcher.on('unlink', onFsEvent);
    },
  };
}
