import {expect, it} from '@jest/globals';
import {
  DEFAULT_OPENROUTER_EVAL_MODEL,
  getOpenRouterEvalModel,
} from '../evalModel';

it('uses the shared model override and preserves the local default', () => {
  expect(getOpenRouterEvalModel({})).toBe(DEFAULT_OPENROUTER_EVAL_MODEL);
  expect(
    getOpenRouterEvalModel({SQLROOMS_EVAL_MODEL: ' openai/gpt-5.5 '}),
  ).toBe('openai/gpt-5.5');
});

it('does not silently default an explicitly empty model', () => {
  expect(() => getOpenRouterEvalModel({SQLROOMS_EVAL_MODEL: ' '})).toThrow(
    'SQLROOMS_EVAL_MODEL must be non-empty',
  );
});
