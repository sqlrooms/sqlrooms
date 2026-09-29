import {loadEnvFile} from 'node:process';

type EnvFileLoader = (path: string) => void;

/** Loads local eval settings; Node preserves values already in the environment. */
export function loadLocalEvalEnvironment(
  load: EnvFileLoader = loadEnvFile,
): void {
  try {
    load('.env.local');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
