import {describe, expect, it} from '@jest/globals';
import {claudeArguments, readClaudeOutput} from '../external/claude';
import {codexArguments, readCodexOutput} from '../external/codex';
import {summarizeBehavioralCheckResults} from '../behavioralCheck';

const jsonl = (...records: unknown[]) =>
  records.map((record) => JSON.stringify(record)).join('\n');

describe('readCodexOutput', () => {
  it('grades the last agent message and finds skill reads', () => {
    const output = readCodexOutput(
      jsonl(
        {
          type: 'item.completed',
          item: {type: 'agent_message', text: 'Planning.'},
        },
        {
          type: 'item.completed',
          item: {
            type: 'command_execution',
            command: 'cat .agents/skills/demo/SKILL.md',
            exit_code: 0,
            aggregated_output: '# Demo skill',
          },
        },
        {type: 'item.completed', item: {type: 'agent_message', text: 'Done.'}},
        {type: 'turn.completed', usage: {input_tokens: 5, output_tokens: 2}},
      ),
      {skillName: 'demo'},
    );
    expect(output).toMatchObject({
      finalAnswer: 'Done.',
      completed: true,
      failed: false,
      usage: {input_tokens: 5, output_tokens: 2},
      skillReads: [
        {command: 'cat .agents/skills/demo/SKILL.md', output: '# Demo skill'},
      ],
    });
  });

  it('builds MCP configuration for the named server and token variable', () => {
    const args = codexArguments({
      cwd: '/tmp/run',
      url: 'http://127.0.0.1:1/mcp',
      model: 'gpt-5.5',
      prompt: 'Go.',
      disabledSkills: [],
      skillName: 'demo',
      mcpServerName: 'demo-app',
      tokenEnvVar: 'DEMO_TOKEN',
    });
    expect(args.at(-1)).toBe('$demo\n\nGo.');
    expect(args.join(' ')).toContain(
      'mcp_servers.demo-app={url="http://127.0.0.1:1/mcp",bearer_token_env_var="DEMO_TOKEN"',
    );
  });
});

describe('readClaudeOutput', () => {
  it('requires a successful skill invocation and strips read line numbers', () => {
    const output = readClaudeOutput(
      jsonl(
        {
          type: 'assistant',
          message: {
            model: 'claude-test',
            content: [
              {
                type: 'tool_use',
                id: 's',
                name: 'Skill',
                input: {skill: 'demo:demo'},
              },
              {
                type: 'tool_use',
                id: 'r',
                name: 'Read',
                input: {file_path: '/x/plugin/skills/demo/SKILL.md'},
              },
            ],
          },
        },
        {
          type: 'user',
          message: {
            content: [
              {type: 'tool_result', tool_use_id: 's', content: 'ok'},
              {
                type: 'tool_result',
                tool_use_id: 'r',
                content: '     1\t# Demo\n     2\t  indented',
              },
            ],
          },
        },
        {
          type: 'result',
          subtype: 'success',
          result: 'Finished.',
          usage: {input_tokens: 1},
        },
      ),
      {skillId: 'demo:demo', skillPathFragment: '/skills/demo/'},
    );
    expect(output).toMatchObject({
      finalAnswer: 'Finished.',
      failed: false,
      skillInvoked: true,
      observedModelId: 'claude-test',
      skillReads: [
        {
          command: '/x/plugin/skills/demo/SKILL.md',
          output: '# Demo\n  indented',
        },
      ],
    });
  });

  it('passes allowed tools and MCP configuration through', () => {
    const args = claudeArguments({
      pluginDir: '/tmp/plugin',
      mcpConfig: '/tmp/plugin/.mcp.json',
      allowedTools: ['Skill(demo:demo)', 'mcp__demo__*'],
      appendSystemPrompt: 'Be careful.',
      prompt: 'Go.',
    });
    expect(args).toContain('/tmp/plugin/.mcp.json');
    expect(args).toContain('Skill(demo:demo),mcp__demo__*');
    expect(args.slice(-2)).toEqual(['--', 'Go.']);
  });
});

describe('not-applicable check results', () => {
  it('are excluded from summaries', () => {
    const base = {kind: 'trajectory' as const, evidence: {}, metadata: {}};
    expect(
      summarizeBehavioralCheckResults([
        {...base, checkId: 'a', pass: true, score: 1, reason: 'ok'},
        {
          ...base,
          checkId: 'b',
          pass: true,
          score: 1,
          reason: 'n/a',
          notApplicable: true,
        },
      ]),
    ).toEqual({pass: true, score: 1});
    expect(
      summarizeBehavioralCheckResults([
        {
          ...base,
          checkId: 'b',
          pass: true,
          score: 1,
          reason: 'n/a',
          notApplicable: true,
        },
      ]),
    ).toEqual({pass: false, score: 0});
  });
});
