import {tool} from 'ai';
import {z} from 'zod';
import {measureProviderContext} from '../src/devtools/providerContextDiagnostics';

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
});
