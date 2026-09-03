/** @jest-environment jsdom */
import {jest} from '@jest/globals';
import {Editor, EditorContent} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {BlockDocumentEditorContext} from '../src/BlockDocumentEditor/BlockDocumentEditorContext';
import {BlockDocumentChartImageNode} from '../src/BlockDocumentEditor/extensions/BlockDocumentChartImageNode';
import {BlockDocumentImageNode} from '../src/BlockDocumentEditor/extensions/BlockDocumentImageNode';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('asset block capture targets', () => {
  it.each([false, true])(
    'exposes image and chart-image node IDs in the mounted editor (readOnly=%s)',
    async (readOnly) => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      const value = {
        type: 'doc' as const,
        content: ['blockDocumentImage', 'blockDocumentChartImage'].map(
          (type) => ({
            type,
            attrs: {id: `${type}-1`, assetId: 'asset-1', caption: type},
          }),
        ),
      };
      const editor = new Editor({
        extensions: [
          StarterKit,
          BlockDocumentImageNode,
          BlockDocumentChartImageNode,
        ],
        content: value,
        editable: !readOnly,
      });

      try {
        await act(async () => {
          root.render(
            <BlockDocumentEditorContext.Provider
              value={{
                editor,
                documentId: 'document-1',
                value,
                readOnly,
                onChange: jest.fn(),
                generateBlockId: () => 'generated-block',
                assets: {
                  'asset-1': {
                    id: 'asset-1',
                    mediaType: 'image/png',
                    encoding: 'base64',
                    data: 'cG5n',
                    createdAt: 0,
                    updatedAt: 0,
                  },
                },
              }}
            >
              <EditorContent editor={editor} />
            </BlockDocumentEditorContext.Provider>,
          );
        });

        for (const node of value.content) {
          const block = container.querySelector(
            `[data-block-document-block-id="${node.attrs.id}"]`,
          );
          expect(block).not.toBeNull();
          expect(block?.querySelector('img')?.getAttribute('src')).toBe(
            'data:image/png;base64,cG5n',
          );
          expect(
            block?.querySelector(readOnly ? 'figcaption' : 'input'),
          ).not.toBeNull();
        }
      } finally {
        await act(async () => {
          root.unmount();
          editor.destroy();
        });
        container.remove();
      }
    },
  );
});
