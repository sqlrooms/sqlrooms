import {jest} from '@jest/globals';
import {tool} from 'ai';
import {z} from 'zod';
import {
  measureProviderContext,
  mergeLatestProviderContextMetricsForSession,
  tryMeasureProviderContext,
} from '../src/devtools/providerContextDiagnostics';

describe('measureProviderContext', () => {
  it('captures deterministic metadata without retaining provider content', async () => {
    const diagnostic = await measureProviderContext({
      role: 'skill-discovery',
      provider: 'test-provider',
      model: 'test-model',
      sessionId: 'session-1',
      step: 2,
      instructions: 'héllo',
      messages: [{role: 'user', content: 'sensitive prompt'}],
      tools: {
        zebra: tool({
          description: 'Second tool',
          inputSchema: z.object({value: z.string()}),
        }),
        alpha: tool({
          description: 'First tool',
          inputSchema: z.object({count: z.number()}),
        }),
      },
      sources: ['catalog', 'question', 'catalog'],
      preparationMetrics: {catalogChars: 20, candidateSkillCount: 2},
    });

    expect(diagnostic).toMatchObject({
      role: 'skill-discovery',
      provider: 'test-provider',
      model: 'test-model',
      sessionId: 'session-1',
      step: 2,
      instructions: {chars: 5, bytes: 6},
      messages: {count: 1},
      sources: ['catalog', 'question'],
      preparationMetrics: {catalogChars: 20, candidateSkillCount: 2},
    });
    expect(diagnostic.messages.bytes).toBeGreaterThan(0);
    expect(diagnostic.tools.map(({name}) => name)).toEqual(['alpha', 'zebra']);
    expect(diagnostic.toolSchemaBytes).toBe(
      diagnostic.tools.reduce((sum, entry) => sum + entry.schemaBytes, 0),
    );
    expect(JSON.stringify(diagnostic)).not.toContain('sensitive prompt');
    expect(JSON.stringify(diagnostic)).not.toContain('héllo');
    expect(JSON.stringify(diagnostic)).not.toContain('Second tool');
  });

  it('measures a request without tools', async () => {
    const diagnostic = await measureProviderContext({
      role: 'one-shot-helper',
      provider: 'provider',
      model: 'model',
      step: 0,
      instructions: '',
      messages: [],
    });

    expect(diagnostic.tools).toEqual([]);
    expect(diagnostic.toolSchemaBytes).toBe(0);
    expect(diagnostic.messages).toEqual({count: 0, bytes: 2});
  });

  it('fails open when diagnostics cannot serialize a tool schema', async () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const brokenTool = {
      description: 'Broken schema',
      get inputSchema(): never {
        throw new Error('schema unavailable');
      },
    };

    await expect(
      tryMeasureProviderContext({
        role: 'chat-coordinator',
        provider: 'provider',
        model: 'model',
        step: 0,
        instructions: '',
        messages: [],
        tools: {broken: brokenTool as never},
      }),
    ).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalledTimes(1);
    warning.mockRestore();
  });

  it('merges preparation metrics only into the matching session', () => {
    const shared = {
      recordedAt: 1,
      provider: 'provider',
      model: 'model',
      step: 0,
      instructions: {chars: 0, bytes: 0},
      messages: {count: 0, bytes: 0},
      tools: [],
      toolSchemaBytes: 0,
      sources: [],
    };
    const diagnostics = [
      {id: 'a', role: 'skill-discovery', sessionId: 'session-a', ...shared},
      {id: 'b', role: 'skill-discovery', sessionId: 'session-b', ...shared},
    ];

    mergeLatestProviderContextMetricsForSession(
      diagnostics,
      'skill-discovery',
      {candidateSkillCount: 3},
      'session-a',
    );

    expect(diagnostics[0]?.preparationMetrics).toEqual({
      candidateSkillCount: 3,
    });
    expect(diagnostics[1]?.preparationMetrics).toBeUndefined();
  });
});
