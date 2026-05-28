import {Extension} from '@tiptap/react';

type AnalysisBlockIdOptions = {
  types: string[];
};

type ExtensionLike = {
  name?: unknown;
  type?: unknown;
  options?: unknown;
  config?: {
    group?: unknown;
    addExtensions?: (this: ExtensionLike) => unknown;
  };
};

function isExtensionLike(value: unknown): value is ExtensionLike {
  return typeof value === 'object' && value !== null;
}

function groupContainsBlock(group: unknown) {
  return typeof group === 'string' && group.split(/\s+/).includes('block');
}

function getNestedExtensions(extension: ExtensionLike): ExtensionLike[] {
  const addExtensions = extension.config?.addExtensions;
  if (typeof addExtensions !== 'function') return [];

  const nested = addExtensions.call(extension);
  return Array.isArray(nested) ? nested.filter(isExtensionLike) : [];
}

/**
 * Finds the node names that should behave as Analysis document blocks.
 *
 * Analysis documents store a stable `attrs.id` on each top-level block so
 * command tools, block controls, and external store updates can refer to a
 * block without depending on its current document position. Some of these
 * blocks come from composite extensions such as `StarterKit`, so the helper
 * recursively walks the registered Tiptap extensions and selects node
 * extensions whose schema group contains `block`.
 *
 * Keeping this derived from the editor's actual extension set avoids a
 * duplicate hardcoded list that can drift when new block extensions are added.
 */
export function getBlockNodeExtensionNames(extensions: readonly unknown[]) {
  const names = new Set<string>();
  const visit = (extension: ExtensionLike) => {
    if (
      extension.type === 'node' &&
      typeof extension.name === 'string' &&
      groupContainsBlock(extension.config?.group)
    ) {
      names.add(extension.name);
    }
    for (const nestedExtension of getNestedExtensions(extension)) {
      visit(nestedExtension);
    }
  };

  for (const extension of extensions) {
    if (isExtensionLike(extension)) visit(extension);
  }

  return [...names];
}

/**
 * Adds the Analysis block id attribute to all block node types used by the
 * editor.
 *
 * Tiptap drops unknown attrs when serializing nodes. Without this extension,
 * built-in nodes such as paragraphs and headings would lose `attrs.id` after an
 * edit. The Analysis normalizer would then generate replacement ids, the
 * external document value would appear different, and the editor would be
 * forced through `setContent`, which can move the selection to the end of the
 * document.
 *
 * The id is also rendered as `data-analysis-block-id` so it survives HTML
 * parse/render cycles and can be inspected in the DOM during debugging.
 */
export const AnalysisBlockIdExtension =
  Extension.create<AnalysisBlockIdOptions>({
    name: 'analysisBlockId',

    addOptions() {
      return {
        types: [],
      };
    },

    addGlobalAttributes() {
      if (!this.options.types.length) return [];

      return [
        {
          types: this.options.types,
          attributes: {
            id: {
              default: null,
              parseHTML: (element) =>
                element.getAttribute('data-analysis-block-id'),
              renderHTML: (attributes) => {
                if (typeof attributes.id !== 'string') return {};
                return {'data-analysis-block-id': attributes.id};
              },
            },
          },
        },
      ];
    },
  });
