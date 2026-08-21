import {describe, expect, it, jest} from '@jest/globals';
import {loadLocalEvalEnvironment} from '../loadLocalEvalEnvironment';

describe('loadLocalEvalEnvironment', () => {
  it('keeps an externally supplied key authoritative', () => {
    const load = jest.fn<(path: string) => void>();

    loadLocalEvalEnvironment({OPENROUTER_API_KEY: 'github-secret'}, load);

    expect(load).not.toHaveBeenCalled();
  });

  it('loads the repository-local environment when the key is unset', () => {
    const load = jest.fn<(path: string) => void>();

    loadLocalEvalEnvironment({}, load);

    expect(load).toHaveBeenCalledWith('.env.local');
  });

  it('allows the local environment file to be absent', () => {
    const missing = Object.assign(new Error('missing'), {code: 'ENOENT'});
    const load = jest.fn<(path: string) => void>(() => {
      throw missing;
    });

    expect(() => loadLocalEvalEnvironment({}, load)).not.toThrow();
  });

  it('surfaces other environment-file errors', () => {
    const invalid = Object.assign(new Error('invalid'), {code: 'EINVAL'});
    const load = jest.fn<(path: string) => void>(() => {
      throw invalid;
    });

    expect(() => loadLocalEvalEnvironment({}, load)).toThrow(invalid);
  });
});
