import {describe, expect, it} from '@jest/globals';
import {generateText, stepCountIs, tool} from 'ai';
import {z} from 'zod';
import {createScriptedLanguageModel} from '../scriptedModel';

describe('scripted AI SDK model', () => {
  it('drives a deterministic tool loop and records calls', async () => {
    const scripted = createScriptedLanguageModel({
      steps: [
        {
          expectation: {
            promptIncludes: ['Inspect the document'],
            availableToolNames: ['inspect_workspace'],
          },
          content: [
            {
              type: 'tool-call',
              toolName: 'inspect_workspace',
              input: {documentId: 'document-1'},
            },
          ],
        },
        {
          content: [{type: 'text', text: 'The document is valid.'}],
          usage: {inputTokens: 10, outputTokens: 5},
        },
      ],
    });

    const result = await generateText({
      model: scripted.model,
      prompt: 'Inspect the document.',
      tools: {
        inspect_workspace: tool({
          description: 'Inspect durable workspace state.',
          inputSchema: z.object({documentId: z.string()}),
          execute: async ({documentId}) => ({documentId, valid: true}),
        }),
      },
      stopWhen: stepCountIs(2),
    });

    expect(result.text).toBe('The document is valid.');
    expect(scripted.calls).toHaveLength(2);
    expect(scripted.remainingSteps()).toBe(0);
    expect(() => scripted.assertComplete()).not.toThrow();
  });

  it('fails clearly when script expectations or call counts diverge', async () => {
    const scripted = createScriptedLanguageModel({
      steps: [
        {
          expectation: {promptIncludes: ['expected prompt']},
          content: [{type: 'text', text: 'unused'}],
        },
      ],
    });

    await expect(
      scripted.model.doGenerate({prompt: [{role: 'user', content: []}]}),
    ).rejects.toThrow('expected prompt');
    expect(() => scripted.assertComplete()).not.toThrow();
    await expect(
      scripted.model.doGenerate({prompt: [{role: 'user', content: []}]}),
    ).rejects.toThrow('more calls than configured');
  });

  it('supports the AI SDK streaming model path', async () => {
    const scripted = createScriptedLanguageModel({
      steps: [{content: [{type: 'text', text: 'streamed result'}]}],
    });
    const result = await scripted.model.doStream({
      prompt: [{role: 'user', content: [{type: 'text', text: 'stream'}]}],
    });
    const parts = [];
    for await (const part of result.stream) parts.push(part);

    expect(parts).toContainEqual({
      type: 'text-delta',
      id: 'text-0',
      delta: 'streamed result',
    });
    expect(parts.at(-1)).toMatchObject({
      type: 'finish',
      finishReason: {unified: 'stop'},
    });
  });
});
