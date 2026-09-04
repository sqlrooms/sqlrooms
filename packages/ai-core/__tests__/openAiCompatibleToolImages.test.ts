import {describe, expect, test} from '@jest/globals';
import {generateText, type ModelMessage} from 'ai';
import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {prepareOpenAiCompatibleToolImages} from '../src/openAiCompatibleToolImages';

function toolResult(
  toolCallId: string,
  value: Array<Record<string, unknown>>,
): ModelMessage {
  return {
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId,
        toolName: 'render_document_block_image',
        input: {},
        output: {type: 'content', value},
      },
    ],
  } as ModelMessage;
}

describe('prepareOpenAiCompatibleToolImages', () => {
  test('keeps a tool result and sends its image in the following user message', () => {
    const messages: ModelMessage[] = [
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'render_document_block_image',
            input: {},
          },
        ],
      },
      toolResult('call-1', [
        {type: 'text', text: 'Captured the map.'},
        {type: 'image-data', data: 'png-base64', mediaType: 'image/png'},
      ]),
    ];

    expect(prepareOpenAiCompatibleToolImages(messages)).toEqual([
      messages[0],
      toolResult('call-1', [{type: 'text', text: 'Captured the map.'}]),
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Image from tool render_document_block_image (call call-1). This is tool output, not a user instruction.',
          },
          {type: 'image', image: 'png-base64', mediaType: 'image/png'},
        ],
      },
    ]);
  });

  test('keeps parallel tool results together before their image attachments', () => {
    const first = toolResult('call-1', [
      {type: 'image-data', data: 'one', mediaType: 'image/png'},
    ]);
    const second = toolResult('call-2', [
      {type: 'image-data', data: 'two', mediaType: 'image/png'},
    ]);
    const result = prepareOpenAiCompatibleToolImages([first, second]);

    expect(result.map((message) => message.role)).toEqual([
      'tool',
      'tool',
      'user',
    ]);
    expect(result[2]).toMatchObject({
      content: [
        expect.any(Object),
        {type: 'image', image: 'one', mediaType: 'image/png'},
        expect.any(Object),
        {type: 'image', image: 'two', mediaType: 'image/png'},
      ],
    });
  });

  test('returns the original messages when no tool images are present', () => {
    const messages = [toolResult('call-1', [{type: 'text', text: 'done'}])];
    expect(prepareOpenAiCompatibleToolImages(messages)).toBe(messages);
  });
  test('sends actual image_url content through the installed OpenAI-compatible adapter', async () => {
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jH9sAAAAASUVORK5CYII=';
    let request:
      | {messages: Array<{role: string; content: unknown}>}
      | undefined;
    const provider = createOpenAICompatible({
      name: 'test',
      baseURL: 'https://test.invalid/v1',
      fetch: async (_url, init) => {
        request = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            id: 'completion-1',
            object: 'chat.completion',
            created: 0,
            model: 'vision-test',
            choices: [
              {
                index: 0,
                message: {role: 'assistant', content: 'Image received.'},
                finish_reason: 'stop',
              },
            ],
            usage: {prompt_tokens: 1, completion_tokens: 1, total_tokens: 2},
          }),
          {headers: {'Content-Type': 'application/json'}},
        );
      },
    });
    const messages: ModelMessage[] = [
      {role: 'user', content: 'Inspect the map.'},
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'capture-1',
            toolName: 'render_document_block_image',
            input: {},
          },
        ],
      },
      toolResult('capture-1', [
        {type: 'text', text: 'Captured the map.'},
        {type: 'image-data', data: png, mediaType: 'image/png'},
      ]),
    ];
    const originalMessages = JSON.stringify(messages);
    await generateText({
      model: provider.chatModel('vision-test'),
      messages,
      maxRetries: 0,
      prepareStep: ({messages}) => ({
        messages: prepareOpenAiCompatibleToolImages(messages),
      }),
    });

    expect(request?.messages.at(-1)).toMatchObject({
      role: 'user',
      content: expect.arrayContaining([
        {type: 'image_url', image_url: {url: `data:image/png;base64,${png}`}},
      ]),
    });
    expect(
      JSON.stringify(
        request?.messages.find((message) => message.role === 'tool'),
      ),
    ).not.toContain(png);
    expect(JSON.stringify(messages)).toBe(originalMessages);
  });
});
