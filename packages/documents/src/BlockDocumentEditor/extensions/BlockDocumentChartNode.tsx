import {mergeAttributes, Node, ReactNodeViewRenderer} from '@tiptap/react';
import {BlockDocumentChartNodeView} from '../node-views/BlockDocumentChartNodeView';
import {stopWidgetNodeViewEvent} from './nodeViewEvents';

/**
 * Reads a chart block's `config` back from the JSON in `data-config`, falling
 * back to an empty config when it is missing or not valid JSON.
 */
function parseChartConfigAttribute(value: string | null): unknown {
  if (!value) return {};
  try {
    return JSON.parse(value) ?? {};
  } catch {
    return {};
  }
}

/**
 * Tiptap node for a chart block in a block document. The chart itself is drawn
 * by the renderer registered with `BlockDocumentChartRendererProvider`.
 */
export const BlockDocumentChartNode = Node.create({
  name: 'blockDocumentChart',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  isolating: true,

  addAttributes() {
    return {
      id: {default: null},
      tableName: {default: null},
      // `config` is an object, so it needs its own HTML (de)serialization:
      // copy/paste goes through clipboard HTML, and Tiptap's default would
      // write it as "[object Object]" and read it back as that string.
      config: {
        default: {},
        parseHTML: (element: HTMLElement) =>
          parseChartConfigAttribute(element.getAttribute('data-config')),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.config == null
            ? {}
            : {'data-config': JSON.stringify(attributes.config)},
      },
      selectionGroupId: {default: null},
      caption: {default: null},
    };
  },

  parseHTML() {
    return [{tag: 'div[data-type="block-document-chart"]'}];
  },

  renderHTML({HTMLAttributes}) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {'data-type': 'block-document-chart'}),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlockDocumentChartNodeView, {
      stopEvent: stopWidgetNodeViewEvent,
    });
  },
});
