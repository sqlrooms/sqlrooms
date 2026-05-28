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
