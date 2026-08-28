/** @jest-environment jsdom */
import {jest} from '@jest/globals';
import {RoomStateProvider} from '@sqlrooms/room-store';
import React, {act} from 'react';
import {
  cleanup,
  createSessionTestStore,
  fireKeyDown,
  mockChatRuntimeModule,
  renderTree,
  setMockRuntime,
  setMockSessionRuntime,
  stubAnalysisActions,
  textarea,
  typeInto,
} from './support';

jest.unstable_mockModule(
  '../src/components/ChatRuntimeContext',
  mockChatRuntimeModule,
);

const {LocalAgentChatComposerProvider} =
  await import('../src/components/composer');
const {Attachments} = await import('../src/components/composer/attachments');
const {QueryControls} = await import('../src/components/QueryControls');
const {ChatAttachmentPreview} =
  await import('../src/components/ChatAttachmentPreview');
const {TooltipProvider} = await import('@sqlrooms/ui');

describe('Chat composer attachments', () => {
  it('opts in through a composer child, sends the file part, and clears it', async () => {
    const runtime = setMockRuntime({prompt: 'Summarize this file'});
    const {container, root} = await renderTree(
      <LocalAgentChatComposerProvider>
        <QueryControls>
          <Attachments />
        </QueryControls>
      </LocalAgentChatComposerProvider>,
    );
    const input =
      container.querySelector<HTMLInputElement>('input[type=file]')!;
    const file = new File(['# Report\n\nRevenue grew.'], 'report.md', {
      type: 'application/octet-stream',
    });

    await act(async () => {
      Object.defineProperty(input, 'files', {
        configurable: true,
        value: [file],
      });
      input.dispatchEvent(new Event('change', {bubbles: true}));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(container.textContent).toContain('report.md');

    await act(async () => {
      fireKeyDown(textarea(container)!);
    });

    expect(runtime.sendPrompt).toHaveBeenCalledTimes(1);
    const [text, attachments] = (
      runtime.sendPrompt as jest.MockedFunction<typeof runtime.sendPrompt>
    ).mock.calls[0]!;
    expect(text).toBeUndefined();
    expect(attachments).toEqual([
      expect.objectContaining({
        type: 'file',
        filename: 'report.md',
        mediaType: 'text/markdown',
        url: expect.stringMatching(/^data:application\/octet-stream;base64,/),
      }),
    ]);
    expect(container.textContent).not.toContain('report.md');

    await cleanup(container, root);
  });

  it('forwards attachments through session-mode analysis', async () => {
    setMockSessionRuntime();
    const store = createSessionTestStore();
    const {startAnalysisWhenReady} = stubAnalysisActions(store);
    const {container, root} = await renderTree(
      <TooltipProvider>
        <RoomStateProvider roomStore={store}>
          <QueryControls>
            <Attachments />
          </QueryControls>
        </RoomStateProvider>
      </TooltipProvider>,
    );
    const input =
      container.querySelector<HTMLInputElement>('input[type=file]')!;

    await act(async () => {
      Object.defineProperty(input, 'files', {
        configurable: true,
        value: [new File(['plain text'], 'notes.txt', {type: 'text/plain'})],
      });
      input.dispatchEvent(new Event('change', {bubbles: true}));
      await new Promise((resolve) => setTimeout(resolve, 20));
      typeInto(textarea(container)!, 'Read the notes');
    });

    await act(async () => {
      fireKeyDown(textarea(container)!);
    });

    const sessionId = store.getState().ai.getCurrentSession()?.id;
    expect(startAnalysisWhenReady).toHaveBeenCalledWith(
      sessionId,
      expect.arrayContaining([
        expect.objectContaining({
          type: 'file',
          filename: 'notes.txt',
          mediaType: 'text/plain',
        }),
      ]),
    );

    await cleanup(container, root);
  });

  it('opens text and image attachments in dialogs', async () => {
    const textAttachment = {
      type: 'file' as const,
      filename: 'notes.md',
      mediaType: 'text/markdown',
      url: `data:text/markdown;base64,${btoa('# Heading\n\nBody')}`,
    };
    const {container, root} = await renderTree(
      <ChatAttachmentPreview attachment={textAttachment} />,
    );

    await act(async () => {
      container.querySelector('button')!.click();
    });

    expect(document.body.textContent).toContain('Attached text file preview');
    expect(document.body.textContent).toContain('Heading');
    expect(document.body.textContent).toContain('Body');

    await cleanup(container, root);

    const imageAttachment = {
      type: 'file' as const,
      filename: 'chart.png',
      mediaType: 'image/png',
      url: 'data:image/png;base64,aW1hZ2U=',
    };
    const imageTree = await renderTree(
      <ChatAttachmentPreview attachment={imageAttachment} />,
    );

    await act(async () => {
      imageTree.container.querySelector('button')!.click();
    });

    expect(document.body.textContent).toContain('Attached image preview');
    expect(document.body.querySelectorAll('img[alt="chart.png"]')).toHaveLength(
      2,
    );

    await cleanup(imageTree.container, imageTree.root);
  });
});
