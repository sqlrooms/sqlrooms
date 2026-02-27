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
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let isRunning = false;
  let rerunRequested = false;

  const runGenerateSerial = async () => {
    if (isRunning) {
      rerunRequested = true;
      return;
    }
    isRunning = true;
    try {
      do {
        rerunRequested = false;
        await runGenerate();
      } while (rerunRequested);
    } finally {
      isRunning = false;
    }
  };

  return {
    name: 'sqlrooms-cli-scaffolds',
    async buildStart() {
      try {
        await runGenerate();
      } catch (err) {
        this.error(err instanceof Error ? err.message : String(err));
      }
    },
    configureServer(server) {
      const watcher = server.watcher;
      watcher.add(scaffoldsRoot);
      const onFsEvent = (changedPath: string) => {
        if (!changedPath.startsWith(scaffoldsRoot)) return;
        if (changedPath === outputFile) return;
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
          void runGenerateSerial().catch((err) => {
            console.error(
              '[sqlrooms-cli-scaffolds] failed to regenerate scaffolds',
              err,
            );
            throw err;
          });
        }, 150);
      };
      watcher.on('add', onFsEvent);
      watcher.on('change', onFsEvent);
      watcher.on('unlink', onFsEvent);
    },
  };
}
