/**
 * @jest-environment jsdom
 */
import {jest} from '@jest/globals';
import {Schema} from '@tiptap/pm/model';
import {EditorState, TextSelection} from '@tiptap/pm/state';
import {mergeAttributes, Node, type Editor} from '@tiptap/react';
import React, {act, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import type {BlockDocumentEditorContentProps} from '../src/BlockDocumentEditor/BlockDocumentEditorContent';
import {
  BlockDocumentEditorContext,
  type BlockDocumentEditorContextValue,
} from '../src/BlockDocumentEditor/BlockDocumentEditorContext';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.unstable_mockModule('@sqlrooms/ui', () => {
  const Wrapper = ({children}: {children?: ReactNode}) => children;
  return {
    Button: Wrapper,
    DropdownMenu: Wrapper,
    DropdownMenuContent: Wrapper,
    DropdownMenuItem: Wrapper,
    DropdownMenuLabel: Wrapper,
    DropdownMenuSeparator: Wrapper,
    DropdownMenuSub: Wrapper,
    DropdownMenuSubContent: Wrapper,
    DropdownMenuSubTrigger: Wrapper,
    DropdownMenuTrigger: Wrapper,
    Popover: Wrapper,
    PopoverAnchor: Wrapper,
    PopoverContent: Wrapper,
    Tooltip: Wrapper,
    TooltipContent: Wrapper,
    TooltipProvider: Wrapper,
    TooltipTrigger: Wrapper,
    cn: (...classes: Array<string | undefined>) =>
      classes.filter(Boolean).join(' '),
    ScrollArea: ({
      children,
      viewportRef,
      ...props
    }: {
      children: ReactNode;
      viewportRef?: (element: HTMLDivElement | null) => void;
    }) => (
      <div {...props}>
        <div ref={viewportRef}>{children}</div>
      </div>
    ),
  };
});

jest.unstable_mockModule('@tiptap/react', () => ({
  mergeAttributes,
  Node,
  EditorContent: ({editor}: {editor: Editor}) => (
    <div
      ref={(element) => {
        if (element) {
          Object.assign(editor.view, {dom: element});
        }
      }}
      data-testid="editor"
    >
      <p data-testid="text">{editor.state.doc.textContent}</p>
    </div>
  ),
}));

jest.unstable_mockModule('../src/block-settings/useBlockSettingsStore', () => ({
  useBlockSettingsStore: () => jest.fn(),
}));

const {BlockDocumentEditorContent} =
  await import('../src/BlockDocumentEditor/BlockDocumentEditorContent');

const schema = new Schema({
  nodes: {
    doc: {content: 'paragraph+'},
    paragraph: {content: 'text*'},
    text: {},
  },
});

function createEditor(text = 'Hello world', isFocused = false) {
  const doc = schema.node('doc', undefined, [
    schema.node('paragraph', undefined, schema.text(text)),
  ]);
  let state = EditorState.create({doc});
  const dispatch = jest.fn();
  const focus = jest.fn();
  const view = {
    dom: document.createElement('div'),
    dispatch,
    focus,
    nodeDOM: (): Element | null => view.dom.firstElementChild,
    posAtDOM: () => 0,
    posAtCoords: () => ({pos: 2, inside: 0}),
  };
  const editor = {
    isFocused,
    get state() {
      return state;
    },
    view,
    on: jest.fn(),
    off: jest.fn(),
  } as unknown as Editor;

  return {
    dispatch,
    editor,
    focus,
    setSelection(from: number, to = from) {
      state = state.apply(
        state.tr.setSelection(TextSelection.create(state.doc, from, to)),
      );
    },
  };
}

function renderContent(
  editor: Editor,
  props: BlockDocumentEditorContentProps = {},
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const context: BlockDocumentEditorContextValue = {
    editor,
    documentId: 'document-1',
    value: {type: 'doc', content: []},
    assets: {},
    onChange: jest.fn(),
    readOnly: false,
    generateBlockId: () => 'generated-block',
  };

  act(() => {
    root.render(
      <BlockDocumentEditorContext.Provider value={context}>
        <BlockDocumentEditorContent {...props} />
      </BlockDocumentEditorContext.Provider>,
    );
  });

  return {container, root};
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => root.unmount());
  container.remove();
}

describe('BlockDocumentEditorContent', () => {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

  beforeAll(() => {
    HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  afterAll(() => {
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it.each([
    {showImageBlockMenuItem: undefined, showsImage: true},
    {showImageBlockMenuItem: false, showsImage: false},
  ])(
    'shows Image in slash search: $showsImage',
    ({showImageBlockMenuItem, showsImage}) => {
      const {editor} = createEditor('/', true);
      const {container, root} = renderContent(editor, {showImageBlockMenuItem});

      try {
        const labels = Array.from(
          container.querySelectorAll('[data-block-type-search-item]'),
          (item) => item.textContent,
        );
        expect(labels).toContain('Chart');
        expect(labels.includes('Image')).toBe(showsImage);
      } finally {
        cleanup(root, container);
      }
    },
  );

  it('preserves a text selection created by a mouse drag', () => {
    const {dispatch, editor, focus, setSelection} = createEditor();
    const {container, root} = renderContent(editor);
    const text = container.querySelector<HTMLElement>('[data-testid="text"]')!;

    try {
      act(() => {
        text.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
        setSelection(1, 6);
        text.dispatchEvent(new MouseEvent('click', {bubbles: true}));
      });

      expect(dispatch).not.toHaveBeenCalled();
      expect(focus).not.toHaveBeenCalled();
      expect(editor.state.selection.from).toBe(1);
      expect(editor.state.selection.to).toBe(6);
    } finally {
      cleanup(root, container);
    }
  });

  it('still focuses the closest text block for an ordinary click', () => {
    const {dispatch, editor, focus} = createEditor();
    const {container, root} = renderContent(editor);
    const text = container.querySelector<HTMLElement>('[data-testid="text"]')!;

    Object.defineProperty(text, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        top: 0,
        right: 100,
        bottom: 20,
        left: 0,
        width: 100,
        height: 20,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    try {
      act(() => {
        text.dispatchEvent(
          new MouseEvent('mousedown', {
            bubbles: true,
            clientX: 10,
            clientY: 10,
          }),
        );
        text.dispatchEvent(
          new MouseEvent('click', {bubbles: true, clientX: 10, clientY: 10}),
        );
      });

      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(focus).toHaveBeenCalledTimes(1);
    } finally {
      cleanup(root, container);
    }
  });
});
