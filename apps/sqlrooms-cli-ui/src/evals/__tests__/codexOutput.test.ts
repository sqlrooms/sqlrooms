import {expect, it} from '@jest/globals';
import {readCodexOutput} from '../external/codexOutput';
it('grades the final answer rather than a plan and retains unknown usage', () => {
  const stdout = [
    {
      type: 'item.completed',
      item: {type: 'agent_message', text: 'I will create a chart and map.'},
    },
    {
      type: 'item.completed',
      item: {type: 'agent_message', text: 'I could not complete it.'},
    },
    {type: 'turn.completed'},
  ]
    .map((event) => JSON.stringify(event))
    .join('\n');
  expect(readCodexOutput(stdout)).toMatchObject({
    finalAnswer: 'I could not complete it.',
    usage: undefined,
    completed: true,
    skillReads: [],
  });
  expect(readCodexOutput('{"type":"turn.failed"}').failed).toBe(true);
  expect(() => readCodexOutput('truncated json')).toThrow();
});
it('retains benign catalog warnings but fails unexpected harness diagnostics', () => {
  const warning = JSON.stringify({
    type: 'item.completed',
    item: {
      type: 'error',
      message:
        'Skill descriptions were shortened to fit the 2% skills context budget.',
    },
  });
  expect(readCodexOutput(warning)).toMatchObject({
    failed: false,
    diagnostics: [{severity: 'warning'}],
  });
  const error = JSON.stringify({
    type: 'item.completed',
    item: {type: 'error', message: 'Model connection failed'},
  });
  expect(readCodexOutput(error)).toMatchObject({
    failed: true,
    diagnostics: [{severity: 'error'}],
  });
});
it('retains custom-model fallback metadata as a warning without suppressing failures', () => {
  const warning = JSON.stringify({
    type: 'item.completed',
    item: {
      type: 'error',
      message:
        'Model metadata for `deepseek/deepseek-v4-flash-0731` not found. Defaulting to fallback metadata; this can degrade performance and cause issues.',
    },
  });
  expect(readCodexOutput(warning)).toMatchObject({
    failed: false,
    diagnostics: [{severity: 'warning'}],
  });
  expect(
    readCodexOutput(warning + '\n' + JSON.stringify({type: 'turn.failed'}))
      .failed,
  ).toBe(true);
  expect(
    readCodexOutput(
      JSON.stringify({
        type: 'item.completed',
        item: {
          type: 'error',
          message: 'Model metadata for `unknown` not found. Request failed.',
        },
      }),
    ).failed,
  ).toBe(true);
});
