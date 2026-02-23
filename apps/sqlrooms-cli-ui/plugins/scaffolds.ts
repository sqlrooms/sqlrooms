import type {Plugin} from 'vite';
import * as path from 'path';
import {fileURLToPath} from 'node:url';
import {generateScaffoldsModule} from './generateScaffolds';

export default function scaffoldsPlugin(): Plugin {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const appRoot = path.resolve(__dirname, '..');
  const scaffoldsRoot = path.join(appRoot, 'app-scaffolds');
  const outputFile = path.join(scaffoldsRoot, 'scaffolds.generated.json');

  const runGenerate = async () =>
    generateScaffoldsModule({
      scaffoldsRootDir: scaffoldsRoot,
      outputFile,
    });

  return {
    name: 'sqlrooms-cli-scaffolds',
    async buildStart() {
      await runGenerate();
    },
    configureServer(server) {
      const watcher = server.watcher;
      watcher.add(scaffoldsRoot);
      const onFsEvent = async (changedPath: string) => {
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
