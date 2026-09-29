import {expect, it} from '@jest/globals';
import {claudeArguments} from '../external/claudeHarness';
import {readClaudeOutput} from '../external/claudeOutput';

it('uses native plugins and env-based MCP auth without overriding user models', () => {
  const args = claudeArguments({
    pluginDir: '/tmp/plugin',
    prompt: 'Create a document',
  });
  expect(args).toContain('--plugin-dir');
  expect(args).toContain('/tmp/plugin/mcp.json');
  expect(args).toContain('--strict-mcp-config');
  expect(args[args.indexOf('--allowedTools') + 1]).toBe(
    'Read(./plugin/skills/sqlrooms/**),Skill(sqlrooms:sqlrooms),mcp__sqlrooms__*',
  );
  expect(args).not.toContain('--model');
  expect(args).not.toContain('--dangerously-skip-permissions');
  expect(args.slice(-1)).toEqual(['Create a document']);
  expect(
    claudeArguments({
      pluginDir: '/tmp/plugin',
      prompt: 'Edit',
      model: 'sonnet',
    }),
  ).toContain('sonnet');
});

const stream = (...records: unknown[]) =>
  records.map((record) => JSON.stringify(record)).join('\n');
it('requires successful Skill and Read results, and grades only the final result', () => {
  const output = readClaudeOutput(
    stream(
      {
        type: 'assistant',
        message: {
          model: 'observed-model',
          content: [
            {type: 'text', text: 'I will finish'},
            {
              type: 'tool_use',
              id: 's',
              name: 'Skill',
              input: {skill: 'sqlrooms:sqlrooms'},
            },
            {
              type: 'tool_use',
              id: 'r',
              name: 'Read',
              input: {file_path: '/tmp/plugin/skills/sqlrooms/SKILL.md'},
            },
          ],
        },
      },
      {
        type: 'user',
        message: {
          content: [
            {type: 'tool_result', tool_use_id: 's', content: 'Launching skill'},
            {
              type: 'tool_result',
              tool_use_id: 'r',
              content:
                '     1→Guidance\n     2→  - indented\n     3→\n    10\tMore',
            },
          ],
        },
      },
      {
        type: 'result',
        subtype: 'success',
        result: 'Done',
        usage: {input_tokens: 5, output_tokens: 2},
      },
    ),
  );
  expect(output).toMatchObject({
    finalAnswer: 'Done',
    skillInvoked: true,
    failed: false,
    observedModelId: 'observed-model',
  });
  expect(output.skillReads[0]?.output).toBe('Guidance\n  - indented\n\nMore');
});

it('does not treat denied guidance or an interrupted turn as success', () => {
  const output = readClaudeOutput(
    stream(
      {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 's',
              name: 'Skill',
              input: {skill: 'sqlrooms:sqlrooms'},
            },
          ],
        },
      },
      {
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 's',
              is_error: true,
              content: 'Denied',
            },
          ],
        },
      },
    ),
  );
  expect(output).toMatchObject({
    skillInvoked: false,
    failed: true,
    completed: false,
    finalAnswer: '',
  });
  expect(
    readClaudeOutput(
      stream({
        type: 'result',
        subtype: 'error_during_execution',
        is_error: true,
        errors: ['Not logged in'],
      }),
    ).failed,
  ).toBe(true);
});
