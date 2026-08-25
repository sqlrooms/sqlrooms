/**
 * @jest-environment jsdom
 *
 * `Input`'s Enter-to-send keymap and its `onBeforeSend` veto, exercised in
 * local-agent mode where every runtime action is a spy.
 */
import {jest} from '@jest/globals';
import React, {act, type ComponentProps} from 'react';
import {
  cleanup,
  fireKeyDown,
  mockChatRuntimeModule,
  renderTree,
  setMockRuntime,
  textarea,
} from './support';

jest.unstable_mockModule(
  '../src/components/ChatRuntimeContext',
  mockChatRuntimeModule,
);

const {Input, LocalAgentChatComposerProvider: Composer} =
  await import('../src/components/composer');

describe('Input — Enter keymap', () => {
  it('sends on Enter with no modifiers', async () => {
    const runtime = setMockRuntime({prompt: 'hello'});
    const {container, root} = await renderTree(
      <Composer>
        <Input />
      </Composer>,
    );

    await act(async () => {
      fireKeyDown(textarea(container)!);
    });

    // No argument: `send()` means "send whatever the prompt currently holds".
    expect(runtime.sendPrompt).toHaveBeenCalledWith();
    await cleanup(container, root);
  });

  it('does not send on Shift+Enter', async () => {
    const runtime = setMockRuntime({prompt: 'hello'});
    const {container, root} = await renderTree(
      <Composer>
        <Input />
      </Composer>,
    );

    await act(async () => {
      fireKeyDown(textarea(container)!, {shiftKey: true});
    });

    expect(runtime.sendPrompt).not.toHaveBeenCalled();
    await cleanup(container, root);
  });

  it('does not send while an IME composition is active', async () => {
    const runtime = setMockRuntime({prompt: 'hello'});
    const {container, root} = await renderTree(
      <Composer>
        <Input />
      </Composer>,
    );

    await act(async () => {
      fireKeyDown(textarea(container)!, {isComposing: true});
    });
    await act(async () => {
      fireKeyDown(textarea(container)!, {keyCode: 229});
    });

    expect(runtime.sendPrompt).not.toHaveBeenCalled();
    await cleanup(container, root);
  });

  it('does not send and does not cancel on Enter while a run is in flight', async () => {
    const runtime = setMockRuntime({prompt: 'hello', isStreaming: true});
    const {container, root} = await renderTree(
      <Composer>
        <Input />
      </Composer>,
    );

    await act(async () => {
      fireKeyDown(textarea(container)!);
    });

    expect(runtime.sendPrompt).not.toHaveBeenCalled();
    expect(runtime.stop).not.toHaveBeenCalled();
    await cleanup(container, root);
  });

  it('submitOnEnter={false} disables the keymap', async () => {
    const runtime = setMockRuntime({prompt: 'hello'});
    const {container, root} = await renderTree(
      <Composer>
        <Input submitOnEnter={false} />
      </Composer>,
    );

    await act(async () => {
      fireKeyDown(textarea(container)!);
    });

    expect(runtime.sendPrompt).not.toHaveBeenCalled();
    await cleanup(container, root);
  });

  it('a host onKeyDown calling preventDefault suppresses submission', async () => {
    const runtime = setMockRuntime({prompt: 'hello'});
    const hostOnKeyDown = jest.fn((event: React.KeyboardEvent) => {
      event.preventDefault();
    });
    const {container, root} = await renderTree(
      <Composer>
        <Input onKeyDown={hostOnKeyDown} />
      </Composer>,
    );

    await act(async () => {
      fireKeyDown(textarea(container)!);
    });

    expect(hostOnKeyDown).toHaveBeenCalled();
    expect(runtime.sendPrompt).not.toHaveBeenCalled();
    await cleanup(container, root);
  });
});

describe('Input — onBeforeSend', () => {
  it('returning false on Enter prevents the send', async () => {
    const runtime = setMockRuntime({prompt: 'hello'});
    const onBeforeSend = jest.fn<(text: string) => boolean>(() => false);
    const {container, root} = await renderTree(
      <Composer>
        <Input onBeforeSend={onBeforeSend} />
      </Composer>,
    );

    await act(async () => {
      fireKeyDown(textarea(container)!);
    });

    expect(onBeforeSend).toHaveBeenCalledTimes(1);
    expect(runtime.sendPrompt).not.toHaveBeenCalled();
    await cleanup(container, root);
  });

  it('returning undefined or true on Enter allows the send', async () => {
    const runtime = setMockRuntime({prompt: 'hello'});
    const onBeforeSend = jest.fn<(text: string) => boolean | void>(
      () => undefined,
    );
    const {container, root} = await renderTree(
      <Composer>
        <Input onBeforeSend={onBeforeSend} />
      </Composer>,
    );

    await act(async () => {
      fireKeyDown(textarea(container)!);
    });

    expect(onBeforeSend).toHaveBeenCalledTimes(1);
    expect(onBeforeSend).toHaveBeenCalledWith('hello');
    expect(runtime.sendPrompt).toHaveBeenCalledWith();
    await cleanup(container, root);
  });

  // Each case fires one keystroke that a guard rejects before `onBeforeSend`
  // would run, so the hook must never be called.
  const guardCases: Array<{
    name: string;
    prompt: string;
    props: Partial<ComponentProps<typeof Input>>;
    key?: Partial<KeyboardEventInit> & {keyCode?: number};
  }> = [
    {
      name: 'an IME composition is active',
      prompt: 'hello',
      props: {},
      key: {isComposing: true},
    },
    {
      name: 'a modifier is held',
      prompt: 'hello',
      props: {},
      key: {shiftKey: true},
    },
    {
      name: 'submitOnEnter is off',
      prompt: 'hello',
      props: {submitOnEnter: false},
    },
    {
      name: 'canSend is false (empty prompt)',
      prompt: '   ',
      props: {},
    },
  ];

  it.each(guardCases)(
    'is not called when $name',
    async ({prompt, props, key}) => {
      const onBeforeSend = jest.fn<(text: string) => boolean>(() => true);
      setMockRuntime({prompt});
      const {container, root} = await renderTree(
        <Composer>
          <Input {...props} onBeforeSend={onBeforeSend} />
        </Composer>,
      );

      await act(async () => {
        fireKeyDown(textarea(container)!, key);
      });
      await cleanup(container, root);

      expect(onBeforeSend).not.toHaveBeenCalled();
    },
  );
});
