/**
 * @jest-environment jsdom
 *
 * The `asChild` substitution contract: a host element must receive activation
 * and disabled state, refs must compose through nested `Slot` layers, and
 * auto-resize must still reach the real DOM node it was handed.
 */
import {jest} from '@jest/globals';
import React, {act, createRef, forwardRef, type ComponentProps} from 'react';
import {
  cleanup,
  flushAutoResizeFrame,
  mockChatRuntimeModule,
  renderTree,
  setMockRuntime,
  textarea,
} from './support';

jest.unstable_mockModule(
  '../src/components/ChatRuntimeContext',
  mockChatRuntimeModule,
);

const {Slot} = await import('@sqlrooms/ui');
const {
  Input,
  Send,
  LocalAgentChatComposerProvider: Composer,
} = await import('../src/components/composer');

const StubButton = forwardRef<HTMLButtonElement, ComponentProps<'button'>>(
  function StubButton(props, ref) {
    return <button ref={ref} data-testid="stub-button" {...props} />;
  },
);

const StubTextarea = forwardRef<
  HTMLTextAreaElement,
  ComponentProps<'textarea'>
>(function StubTextarea(props, ref) {
  return <textarea ref={ref} data-testid="stub-textarea" {...props} />;
});

/** jsdom reports a scrollHeight of 0; auto-resize needs a real number. */
function stubScrollHeight(value: number) {
  Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
    configurable: true,
    value,
  });
}

describe('asChild — activation and refs', () => {
  it('delivers activation and disabled state to a stub component', async () => {
    const runtime = setMockRuntime({prompt: 'hello'});
    const onActivate =
      jest.fn<(event: React.MouseEvent<HTMLButtonElement>) => void>();

    const {container, root} = await renderTree(
      <Composer>
        <Send asChild onClick={onActivate}>
          <StubButton />
        </Send>
      </Composer>,
    );

    const stub = container.querySelector(
      '[data-testid="stub-button"]',
    ) as HTMLButtonElement;
    expect(stub.disabled).toBe(false);
    await act(async () => {
      stub.click();
    });

    expect(onActivate).toHaveBeenCalled();
    expect(runtime.sendPrompt).toHaveBeenCalled();
    await cleanup(container, root);
  });

  it('composes ref and click through two nested Slot layers', async () => {
    const runtime = setMockRuntime({prompt: 'hello'});
    const outerRef = createRef<HTMLButtonElement>();
    const onOuterClick =
      jest.fn<(event: React.MouseEvent<HTMLButtonElement>) => void>();
    const onStubClick =
      jest.fn<(event: React.MouseEvent<HTMLButtonElement>) => void>();

    const {container, root} = await renderTree(
      <Composer>
        <Slot ref={outerRef}>
          <Send asChild onClick={onOuterClick}>
            <StubButton onClick={onStubClick} />
          </Send>
        </Slot>
      </Composer>,
    );

    const stub = container.querySelector(
      '[data-testid="stub-button"]',
    ) as HTMLButtonElement;
    expect(outerRef.current).toBe(stub);

    await act(async () => {
      stub.click();
    });

    expect(onStubClick).toHaveBeenCalled();
    expect(onOuterClick).toHaveBeenCalled();
    expect(runtime.sendPrompt).toHaveBeenCalled();
    await cleanup(container, root);
  });
});

describe('asChild — auto-resize', () => {
  it('applies to a substituted textarea', async () => {
    setMockRuntime({prompt: 'hello\nworld'});
    stubScrollHeight(123);

    const {container, root} = await renderTree(
      <Composer>
        <Input asChild>
          <StubTextarea />
        </Input>
      </Composer>,
    );

    await flushAutoResizeFrame();
    const stub = container.querySelector(
      '[data-testid="stub-textarea"]',
    ) as HTMLTextAreaElement;
    expect(stub.style.height).toBe('123px');
    await cleanup(container, root);
  });

  it('autoResize={false} leaves height unmanaged', async () => {
    setMockRuntime({prompt: 'hello\nworld'});
    stubScrollHeight(123);

    const {container, root} = await renderTree(
      <Composer>
        <Input asChild autoResize={false}>
          <StubTextarea />
        </Input>
      </Composer>,
    );

    await flushAutoResizeFrame();
    const stub = container.querySelector(
      '[data-testid="stub-textarea"]',
    ) as HTMLTextAreaElement;
    expect(stub.style.height).toBe('');
    await cleanup(container, root);
  });

  it("a host's own ref on Input still receives the element while auto-resize also works", async () => {
    setMockRuntime({prompt: 'hi'});
    stubScrollHeight(77);
    const hostRef = createRef<HTMLTextAreaElement>();

    const {container, root} = await renderTree(
      <Composer>
        <Input ref={hostRef} />
      </Composer>,
    );

    await flushAutoResizeFrame();
    const el = textarea(container)!;
    expect(hostRef.current).toBe(el);
    expect(el.style.height).toBe('77px');
    await cleanup(container, root);
  });
});
