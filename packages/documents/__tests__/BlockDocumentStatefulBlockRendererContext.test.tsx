/**
 * @jest-environment jsdom
 */
import {jest} from '@jest/globals';
import type {Editor} from '@tiptap/react';
import {act, type FC} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {BlockDocumentBlockControls} from '../src/BlockDocumentEditor/BlockDocumentBlockControls';
import {
  BlockDocumentEditorContext,
  type BlockDocumentEditorContextValue,
} from '../src/BlockDocumentEditor/BlockDocumentEditorContext';
import {BlockDocumentStatefulBlockNodeView} from '../src/BlockDocumentEditor/node-views/BlockDocumentStatefulBlockNodeView';
import {
  BlockDocumentStatefulBlockRendererProvider,
  isBlockDocumentStatefulBlockTypeEnabled,
  type BlockDocumentStatefulBlockRendererProps,
} from '../src/BlockDocumentStatefulBlockRendererContext';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const emptyDocument = {type: 'doc' as const, content: []};

function createEditorContext(editor: Editor): BlockDocumentEditorContextValue {
  return {
    editor,
    documentId: 'document-1',
    value: emptyDocument,
    assets: {},
    onChange: jest.fn(),
    readOnly: false,
    generateBlockId: () => 'generated-block',
  };
}

function cleanup(root: Root, container: HTMLElement, ...elements: Element[]) {
  act(() => root.unmount());
  container.remove();
  for (const element of elements) element.remove();
}

describe('isBlockDocumentStatefulBlockTypeEnabled', () => {
  const blockTypes = [{blockType: 'map'}, {blockType: 'dashboard'}];

  it('recognizes enabled and disabled persisted stateful block types', () => {
    expect(isBlockDocumentStatefulBlockTypeEnabled(blockTypes, 'map')).toBe(
      true,
    );
    expect(
      isBlockDocumentStatefulBlockTypeEnabled(blockTypes, 'data-table'),
    ).toBe(false);
    expect(isBlockDocumentStatefulBlockTypeEnabled(blockTypes, '')).toBe(false);
  });
});

describe('disabled persisted stateful block interactions', () => {
  it('does not expose convert, delete, or drag controls', () => {
    const scrollElement = document.createElement('div');
    const editorElement = document.createElement('div');
    const blockElement = document.createElement('div');
    const container = document.createElement('div');
    editorElement.appendChild(blockElement);
    scrollElement.appendChild(editorElement);
    document.body.append(scrollElement, container);

    let currentNode = {
      type: {name: 'blockDocumentStatefulBlock'},
      attrs: {id: 'map-1', blockType: 'map'},
      nodeSize: 1,
      textContent: '',
    };
    const editor = {
      isFocused: false,
      on: jest.fn(),
      off: jest.fn(),
      view: {
        dom: editorElement,
        posAtDOM: () => 1,
      },
      state: {
        doc: {
          nodeAt: () => currentNode,
          resolve: () => ({depth: 0}),
        },
        selection: {},
      },
    } as unknown as Editor;
    const root = createRoot(container);

    act(() => {
      root.render(
        <BlockDocumentStatefulBlockRendererProvider
          blockTypes={[{blockType: 'map'}]}
        >
          <BlockDocumentEditorContext.Provider
            value={createEditorContext(editor)}
          >
            <BlockDocumentBlockControls scrollElement={scrollElement} />
          </BlockDocumentEditorContext.Provider>
        </BlockDocumentStatefulBlockRendererProvider>,
      );
    });

    try {
      act(() => {
        blockElement.dispatchEvent(
          new MouseEvent('mousemove', {bubbles: true, clientX: 1, clientY: 1}),
        );
      });
      expect(container.querySelector('[aria-label="Block options"]')).not.toBe(
        null,
      );

      currentNode = {
        ...currentNode,
        attrs: {id: 'dashboard-1', blockType: 'dashboard'},
      };
      act(() => {
        blockElement.dispatchEvent(
          new MouseEvent('mousemove', {bubbles: true, clientX: 1, clientY: 1}),
        );
      });

      expect(
        container.querySelector('[aria-label="Block options"]'),
      ).toBeNull();
      expect(container.querySelector('button[draggable="true"]')).toBeNull();
      expect(container.textContent).not.toContain('Turn into');
      expect(container.textContent).not.toContain('Delete');
    } finally {
      cleanup(root, container, scrollElement);
    }
  });

  it('disables renderer edits, resize, and removal keyboard input', () => {
    const editorElement = document.createElement('div');
    const container = document.createElement('div');
    document.body.append(editorElement, container);
    const updateAttributes = jest.fn();
    const setNodeSelection = jest.fn();
    const renderHeaderActions = jest.fn(() => <button>Header action</button>);
    let rendererProps: BlockDocumentStatefulBlockRendererProps | undefined;
    const TestRenderer: FC<BlockDocumentStatefulBlockRendererProps> = (
      props,
    ) => {
      rendererProps = props;
      return (
        <div>
          <button onClick={() => props.onCaptionChange?.('Changed caption')}>
            Change caption
          </button>
          <button onClick={() => props.onTableNameChange?.('main.changed')}>
            Change table
          </button>
        </div>
      );
    };
    const editor = {
      view: {dom: editorElement},
      commands: {setNodeSelection},
    } as unknown as Editor;
    const root = createRoot(container);

    act(() => {
      root.render(
        <BlockDocumentStatefulBlockRendererProvider
          renderers={{dashboard: TestRenderer}}
          blockTypes={[
            {
              blockType: 'map',
              resizableHeight: true,
              defaultHeight: 560,
            },
          ]}
          renderBlockHeaderActions={renderHeaderActions}
        >
          <BlockDocumentEditorContext.Provider
            value={createEditorContext(editor)}
          >
            <BlockDocumentStatefulBlockNodeView
              node={{
                attrs: {
                  id: 'dashboard-1',
                  blockType: 'dashboard',
                  blockInstanceId: 'dashboard-1',
                  height: 560,
                },
              }}
              selected
              updateAttributes={updateAttributes}
              getPos={() => 1}
              editor={editor}
            />
          </BlockDocumentEditorContext.Provider>
        </BlockDocumentStatefulBlockRendererProvider>,
      );
    });

    try {
      expect(
        container.querySelector('[data-block-document-block-id="dashboard-1"]'),
      ).not.toBeNull();
      expect(rendererProps?.readOnly).toBe(true);
      expect(renderHeaderActions).not.toHaveBeenCalled();
      expect(container.textContent).not.toContain('Header action');
      expect(
        container.querySelector('[aria-label="Resize block height"]'),
      ).toBeNull();

      const buttons = Array.from(container.querySelectorAll('button'));
      act(() => {
        buttons
          .find((button) => button.textContent === 'Change caption')
          ?.click();
        buttons
          .find((button) => button.textContent === 'Change table')
          ?.click();
      });
      expect(updateAttributes).not.toHaveBeenCalled();

      for (const event of [
        new KeyboardEvent('keydown', {
          key: 'Backspace',
          bubbles: true,
          cancelable: true,
        }),
        new KeyboardEvent('keydown', {
          key: 'Delete',
          bubbles: true,
          cancelable: true,
        }),
        new KeyboardEvent('keydown', {
          key: 'x',
          metaKey: true,
          bubbles: true,
          cancelable: true,
        }),
      ]) {
        act(() => editorElement.dispatchEvent(event));
        expect(event.defaultPrevented).toBe(true);
      }

      expect(setNodeSelection).not.toHaveBeenCalled();
      expect(updateAttributes).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container, editorElement);
    }
  });
});
