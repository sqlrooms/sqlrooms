import {loadEnvFile} from 'node:process';

type EnvFileLoader = (path: string) => void;

/** Loads local eval credentials without overriding an existing environment. */
export function loadLocalEvalEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  load: EnvFileLoader = loadEnvFile,
): void {
  if (environment.OPENROUTER_API_KEY) return;

  try {
    load('.env.local');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
