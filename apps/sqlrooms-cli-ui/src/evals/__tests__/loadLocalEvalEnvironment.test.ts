import {describe, expect, it, jest} from '@jest/globals';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {loadLocalEvalEnvironment} from '../loadLocalEvalEnvironment';

describe('loadLocalEvalEnvironment', () => {
  it('loads a local model even with an exported key, without overriding the key', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'sqlrooms-env-test-'));
    const file = path.join(directory, '.env.local');
    try {
      writeFileSync(
        file,
        'OPENROUTER_API_KEY=file-key\nSQLROOMS_EVAL_MODEL=test/local-model\n',
      );
      // Node's native env loader runs outside Jest's copied process.env.
      const script = `
        import {loadLocalEvalEnvironment} from ${JSON.stringify(new URL('../loadLocalEvalEnvironment.ts', import.meta.url).href)};
        loadLocalEvalEnvironment();
        console.log(JSON.stringify({key: process.env.OPENROUTER_API_KEY, model: process.env.SQLROOMS_EVAL_MODEL}));
      `;
      const run = (model?: string) =>
        JSON.parse(
          execFileSync(
            process.execPath,
            ['--input-type=module', '-e', script],
            {
              cwd: directory,
              env: {
                OPENROUTER_API_KEY: 'exported-key',
                ...(model ? {SQLROOMS_EVAL_MODEL: model} : {}),
              },
              encoding: 'utf8',
            },
          ),
        );
      expect(run()).toEqual({key: 'exported-key', model: 'test/local-model'});
      expect(run('test/exported-model')).toEqual({
        key: 'exported-key',
        model: 'test/exported-model',
      });
    } finally {
      rmSync(directory, {recursive: true, force: true});
    }
  });

  it('loads the repository-local environment when the key is unset', () => {
    const load = jest.fn<(path: string) => void>();

    loadLocalEvalEnvironment(load);

    expect(load).toHaveBeenCalledWith('.env.local');
  });

  it('allows the local environment file to be absent', () => {
    const missing = Object.assign(new Error('missing'), {code: 'ENOENT'});
    const load = jest.fn<(path: string) => void>(() => {
      throw missing;
    });

    expect(() => loadLocalEvalEnvironment(load)).not.toThrow();
  });

  it('surfaces other environment-file errors', () => {
    const invalid = Object.assign(new Error('invalid'), {code: 'EINVAL'});
    const load = jest.fn<(path: string) => void>(() => {
      throw invalid;
    });

    expect(() => loadLocalEvalEnvironment(load)).toThrow(invalid);
  });
});
