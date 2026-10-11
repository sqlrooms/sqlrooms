/**
 * @jest-environment jsdom
 *
 * `Send` and `Stop`: which of the two is mounted, when `Send` is disabled, and
 * how each behaves on activation — including `Send`'s `onBeforeSend` veto.
 */
import {jest} from '@jest/globals';
import React, {act} from 'react';
import {
  cleanup,
  mockChatRuntimeModule,
  renderTree,
  rerenderTree,
  setMockRuntime,
} from './support';

jest.unstable_mockModule(
  '../src/components/ChatRuntimeContext',
  mockChatRuntimeModule,
);

const {
  Send,
  Stop,
  LocalAgentChatComposerProvider: Composer,
} = await import('../src/components/composer');

describe('Send / Stop — presence and activation', () => {
  it('Send is disabled with an empty prompt', async () => {
    setMockRuntime({prompt: '  '});
    const {container, root} = await renderTree(
      <Composer>
        <Send />
      </Composer>,
    );

    expect(container.querySelector('button')?.disabled).toBe(true);
    await cleanup(container, root);
  });

  it('Send is absent while running; Stop is absent while idle', async () => {
    // A factory, not a shared element: React bails out of reconciliation when
    // handed the identical element reference twice, so the rerender below
    // needs a fresh one to pick up the swapped runtime.
    const tree = () => (
      <Composer>
        <Send data-testid="send" />
        <Stop data-testid="stop" />
      </Composer>
    );

    setMockRuntime({prompt: 'hello', isStreaming: false});
    const {container, root} = await renderTree(tree());

    expect(container.querySelector('[data-testid="send"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="stop"]')).toBeNull();

    setMockRuntime({prompt: 'hello', isStreaming: true});
    await rerenderTree(root, tree());

    expect(container.querySelector('[data-testid="send"]')).toBeNull();
    expect(container.querySelector('[data-testid="stop"]')).not.toBeNull();

    await cleanup(container, root);
  });

  it('Stop cancels on activation and is never disabled', async () => {
    const runtime = setMockRuntime({isStreaming: true});
    const {container, root} = await renderTree(
      <Composer>
        <Stop />
      </Composer>,
    );

    const button = container.querySelector('button')!;
    expect(button.disabled).toBe(false);
    await act(async () => {
      button.click();
    });

    expect(runtime.stop).toHaveBeenCalled();
    await cleanup(container, root);
  });
});

describe('Send — onBeforeSend', () => {
  it('returning false on activation prevents the send', async () => {
    const runtime = setMockRuntime({prompt: 'hello'});
    const onBeforeSend = jest.fn<(text: string) => boolean>(() => false);
    const {container, root} = await renderTree(
      <Composer>
        <Send onBeforeSend={onBeforeSend} />
      </Composer>,
    );

    await act(async () => {
      container.querySelector('button')!.click();
    });

    expect(onBeforeSend).toHaveBeenCalledTimes(1);
    expect(runtime.sendPrompt).not.toHaveBeenCalled();
    await cleanup(container, root);
  });

  it('returning undefined or true on activation allows the send', async () => {
    const runtime = setMockRuntime({prompt: 'hello'});
    const onBeforeSend = jest.fn<(text: string) => boolean | void>(() => true);
    const {container, root} = await renderTree(
      <Composer>
        <Send onBeforeSend={onBeforeSend} />
      </Composer>,
    );

    await act(async () => {
      container.querySelector('button')!.click();
    });

    expect(onBeforeSend).toHaveBeenCalledTimes(1);
    expect(onBeforeSend).toHaveBeenCalledWith('hello');
    expect(runtime.sendPrompt).toHaveBeenCalled();
    await cleanup(container, root);
  });

  it('is not called when canSend is false (button disabled, click is a no-op)', async () => {
    const runtime = setMockRuntime({prompt: '   '});
    const onBeforeSend = jest.fn<(text: string) => boolean>(() => true);
    const {container, root} = await renderTree(
      <Composer>
        <Send onBeforeSend={onBeforeSend} />
      </Composer>,
    );

    const button = container.querySelector('button')!;
    expect(button.disabled).toBe(true);
    await act(async () => {
      button.click();
    });

    expect(onBeforeSend).not.toHaveBeenCalled();
    expect(runtime.sendPrompt).not.toHaveBeenCalled();
    await cleanup(container, root);
  });
});
