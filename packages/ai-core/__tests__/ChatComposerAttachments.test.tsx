/** @jest-environment jsdom */
import {jest} from '@jest/globals';
import {RoomStateProvider} from '@sqlrooms/room-store';
import React, {act} from 'react';
import type {FileUIPart} from 'ai';
import type {ChatAttachmentsState} from '../src/components/composer';
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
} from './support';

jest.unstable_mockModule(
  '../src/components/ChatRuntimeContext',
  mockChatRuntimeModule,
);

const {LocalAgentChatComposerProvider} =
  await import('../src/components/composer');
const {Attachments, useChatAttachments} =
  await import('../src/components/composer/attachments');
const {QueryControls} = await import('../src/components/QueryControls');
const {ChatAttachmentPreview} =
  await import('../src/components/ChatAttachmentPreview');
const {TooltipProvider} = await import('@sqlrooms/ui');

async function waitForText(
  container: HTMLElement,
  text: string,
): Promise<void> {
  await waitForCondition(
    () =>
      Boolean(container.textContent?.includes(text)) ||
      Array.from(container.querySelectorAll('button')).some(
        (button) => button.getAttribute('aria-label') === `Open ${text}`,
      ),
    text,
  );
}

async function waitForCondition(
  condition: () => boolean,
  description: string,
): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (condition()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function selectAttachment(
  input: HTMLInputElement,
  file: File,
  container: HTMLElement,
): Promise<void> {
  await act(async () => {
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });
    input.dispatchEvent(new Event('change', {bubbles: true}));
  });
  await waitForText(container, file.name);
}

function attachmentInput(
  container: HTMLElement,
  kind: 'image' | 'text' = 'text',
): HTMLInputElement {
  const label =
    kind === 'image' ? 'Attach image files' : 'Attach text or Markdown files';
  return container.querySelector<HTMLInputElement>(
    `input[type=file][aria-label="${label}"]`,
  )!;
}

let customAttachmentState: ChatAttachmentsState | undefined;

function CustomAttachmentHarness() {
  const attachmentState = useChatAttachments();
  React.useEffect(() => {
    customAttachmentState = attachmentState;
    return () => {
      if (customAttachmentState === attachmentState) {
        customAttachmentState = undefined;
      }
    };
  }, [attachmentState]);
  return (
    <span>
      {attachmentState.attachments
        .map((attachment) => attachment.filename)
        .join(',')}
    </span>
  );
}

describe('Chat composer attachments', () => {
  it('shows separate supported-file choices with matching picker filters', async () => {
    setMockRuntime();
    const {container, root} = await renderTree(
      <LocalAgentChatComposerProvider>
        <QueryControls>
          <Attachments />
        </QueryControls>
      </LocalAgentChatComposerProvider>,
    );
    const imageInput = attachmentInput(container, 'image');
    const textInput = attachmentInput(container);
    const imagePicker = jest.spyOn(imageInput, 'click').mockImplementation();
    const textPicker = jest.spyOn(textInput, 'click').mockImplementation();

    expect(imageInput.accept).toBe('image/*');
    expect(textInput.accept).toBe(
      '.txt,.md,.markdown,.mdown,.mkd,text/plain,text/markdown',
    );

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Attach files"]')!
        .dispatchEvent(
          new MouseEvent('pointerdown', {bubbles: true, button: 0}),
        );
    });
    await waitForCondition(
      () => document.body.textContent?.includes('Supported files') ?? false,
      'attachment menu to open',
    );

    expect(document.body.textContent).toContain('Image');
    expect(document.body.textContent).toContain('Any image format');
    expect(document.body.textContent).toContain('Text or Markdown');
    expect(document.body.textContent).toContain(
      '.txt, .md, .markdown, .mdown, .mkd',
    );

    const menuItems = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    );
    await act(async () => menuItems[0]!.click());
    expect(imagePicker).toHaveBeenCalledTimes(1);
    expect(textPicker).not.toHaveBeenCalled();

    await cleanup(container, root);
  });

  it('sends an attachment without prompt text and clears it', async () => {
    const runtime = setMockRuntime({prompt: ''});
    const {container, root} = await renderTree(
      <LocalAgentChatComposerProvider>
        <QueryControls>
          <Attachments />
        </QueryControls>
      </LocalAgentChatComposerProvider>,
    );
    const input = attachmentInput(container);
    const file = new File(['# Report\n\nRevenue grew.'], 'report.md', {
      type: 'application/octet-stream',
    });

    await selectAttachment(input, file, container);

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

  it('forwards an attachment-only send through session-mode analysis', async () => {
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
    const input = attachmentInput(container);

    await selectAttachment(
      input,
      new File(['plain text'], 'notes.txt', {type: 'text/plain'}),
      container,
    );
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

  it('clears pending attachments when the active session changes', async () => {
    setMockSessionRuntime();
    const store = createSessionTestStore();
    const firstSessionId = store.getState().ai.createSession('First');
    const secondSessionId = store.getState().ai.createSession('Second');
    store.getState().ai.switchSession(firstSessionId);
    const {container, root} = await renderTree(
      <TooltipProvider>
        <RoomStateProvider roomStore={store}>
          <QueryControls>
            <Attachments />
          </QueryControls>
        </RoomStateProvider>
      </TooltipProvider>,
    );
    const input = attachmentInput(container);

    await selectAttachment(
      input,
      new File(['private notes'], 'first-session.txt', {type: 'text/plain'}),
      container,
    );
    expect(container.textContent).toContain('first-session.txt');

    await act(async () => {
      store.getState().ai.switchSession(secondSessionId);
    });

    expect(container.textContent).not.toContain('first-session.txt');
    await cleanup(container, root);
  });

  it('does not append a file that finishes reading after a session change', async () => {
    const OriginalFileReader = globalThis.FileReader;
    let finishRead: (() => void) | undefined;
    class DeferredFileReader {
      result: string | ArrayBuffer | null = null;
      error: DOMException | null = null;
      onload: FileReader['onload'] = null;
      onerror: FileReader['onerror'] = null;

      readAsDataURL() {
        finishRead = () => {
          this.result = 'data:text/plain;base64,cHJpdmF0ZSBub3Rlcw==';
          this.onload?.call(
            this as unknown as FileReader,
            new ProgressEvent('load') as ProgressEvent<FileReader>,
          );
        };
      }
    }
    Object.defineProperty(globalThis, 'FileReader', {
      configurable: true,
      value: DeferredFileReader,
    });

    const store = createSessionTestStore();
    const firstSessionId = store.getState().ai.createSession('First');
    const secondSessionId = store.getState().ai.createSession('Second');
    store.getState().ai.switchSession(firstSessionId);
    setMockSessionRuntime();
    const {container, root} = await renderTree(
      <TooltipProvider>
        <RoomStateProvider roomStore={store}>
          <QueryControls>
            <Attachments />
          </QueryControls>
        </RoomStateProvider>
      </TooltipProvider>,
    );

    try {
      const input = attachmentInput(container);
      await act(async () => {
        Object.defineProperty(input, 'files', {
          configurable: true,
          value: [
            new File(['private notes'], 'first-session.txt', {
              type: 'text/plain',
            }),
          ],
        });
        input.dispatchEvent(new Event('change', {bubbles: true}));
      });
      expect(finishRead).toBeDefined();

      await act(async () => {
        store.getState().ai.switchSession(secondSessionId);
      });
      await act(async () => finishRead?.());
      await waitForCondition(
        () =>
          !container
            .querySelector<HTMLButtonElement>(
              'button[aria-label="Attach files"]',
            )
            ?.hasAttribute('disabled'),
        'file read to finish',
      );

      expect(container.textContent).not.toContain('first-session.txt');
    } finally {
      Object.defineProperty(globalThis, 'FileReader', {
        configurable: true,
        value: OriginalFileReader,
      });
      await cleanup(container, root);
    }
  });

  it('protects custom asynchronous appends across session changes', async () => {
    customAttachmentState = undefined;
    setMockSessionRuntime();
    const store = createSessionTestStore();
    const firstSessionId = store.getState().ai.createSession('First');
    const secondSessionId = store.getState().ai.createSession('Second');
    store.getState().ai.switchSession(firstSessionId);
    const {container, root} = await renderTree(
      <TooltipProvider>
        <RoomStateProvider roomStore={store}>
          <QueryControls>
            <CustomAttachmentHarness />
          </QueryControls>
        </RoomStateProvider>
      </TooltipProvider>,
    );

    let finishPreparation: ((attachments: FileUIPart[]) => void) | undefined;
    const preparation = new Promise<FileUIPart[]>((resolve) => {
      finishPreparation = resolve;
    });
    let appendResult: Promise<boolean> | undefined;
    act(() => {
      appendResult = customAttachmentState?.appendAsync(() => preparation);
    });

    await act(async () => {
      store.getState().ai.switchSession(secondSessionId);
    });
    await act(async () => {
      finishPreparation?.([
        {
          type: 'file',
          filename: 'first-session.txt',
          mediaType: 'text/plain',
          url: 'data:text/plain;base64,cHJpdmF0ZSBub3Rlcw==',
        },
      ]);
      await appendResult;
    });

    expect(await appendResult).toBe(false);
    expect(container.textContent).not.toContain('first-session.txt');

    await cleanup(container, root);
  });

  it('rejects images larger than the constrained default', async () => {
    const runtime = setMockRuntime({prompt: 'Inspect this image'});
    const {container, root} = await renderTree(
      <LocalAgentChatComposerProvider>
        <QueryControls>
          <Attachments />
        </QueryControls>
      </LocalAgentChatComposerProvider>,
    );
    const input = attachmentInput(container, 'image');

    await act(async () => {
      Object.defineProperty(input, 'files', {
        configurable: true,
        value: [
          new File([new Uint8Array(1024 * 1024 + 1)], 'large.png', {
            type: 'image/png',
          }),
        ],
      });
      input.dispatchEvent(new Event('change', {bubbles: true}));
    });

    expect(container.textContent).toContain('large.png is too large.');
    await act(async () => {
      fireKeyDown(textarea(container)!);
    });
    expect(runtime.sendPrompt).toHaveBeenCalledWith();

    await cleanup(container, root);
  });

  it('enforces the default combined image attachment size limit', async () => {
    setMockRuntime();
    const {container, root} = await renderTree(
      <LocalAgentChatComposerProvider>
        <QueryControls>
          <Attachments />
        </QueryControls>
      </LocalAgentChatComposerProvider>,
    );
    const input = attachmentInput(container, 'image');

    await selectAttachment(
      input,
      new File([new Uint8Array(600 * 1024)], 'first.png', {type: 'image/png'}),
      container,
    );
    await act(async () => {
      Object.defineProperty(input, 'files', {
        configurable: true,
        value: [
          new File([new Uint8Array(600 * 1024)], 'second.png', {
            type: 'image/png',
          }),
        ],
      });
      input.dispatchEvent(new Event('change', {bubbles: true}));
    });

    expect(
      container.querySelector('button[aria-label="Open first.png"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="Open second.png"]'),
    ).toBeNull();
    expect(container.textContent).toContain(
      'second.png exceeds the combined image attachment limit.',
    );

    await cleanup(container, root);
  });

  it('enforces a combined text attachment size limit', async () => {
    setMockRuntime();
    const {container, root} = await renderTree(
      <LocalAgentChatComposerProvider>
        <QueryControls>
          <Attachments maxTextFileSize={10} maxTotalTextFileSize={12} />
        </QueryControls>
      </LocalAgentChatComposerProvider>,
    );
    const input = attachmentInput(container);

    await selectAttachment(
      input,
      new File(['12345678'], 'first.txt', {type: 'text/plain'}),
      container,
    );
    await act(async () => {
      Object.defineProperty(input, 'files', {
        configurable: true,
        value: [new File(['abcdefgh'], 'second.txt', {type: 'text/plain'})],
      });
      input.dispatchEvent(new Event('change', {bubbles: true}));
    });

    expect(container.textContent).toContain('first.txt');
    expect(
      container.querySelector('button[aria-label="Open second.txt"]'),
    ).toBeNull();
    expect(container.textContent).toContain(
      'second.txt exceeds the combined text attachment limit.',
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
