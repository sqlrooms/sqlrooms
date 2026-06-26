import Link from '@tiptap/extension-link';
import {Table} from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import {Editor, useEditor} from '@tiptap/react';
import {NodeSelection, TextSelection} from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import {
  type FC,
  type PropsWithChildren,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import type {BlockDocumentContent} from '../BlockDocumentSliceConfig';
import type {DocumentAsset} from '../DocumentsSliceConfig';
import {useBlockSettingsStore} from '../block-settings/useBlockSettingsStore';
import {
  BlockDocumentBlockIdExtension,
  getBlockNodeExtensionNames,
} from './extensions/BlockDocumentBlockIdExtension';
import {BlockDocumentChartImageNode} from './extensions/BlockDocumentChartImageNode';
import {BlockDocumentChartNode} from './extensions/BlockDocumentChartNode';
import {BlockDocumentImageNode} from './extensions/BlockDocumentImageNode';
import {BlockDocumentStatefulBlockNode} from './extensions/BlockDocumentStatefulBlockNode';
import {
  BLOCK_DOCUMENT_TITLE_NODE_NAME,
  BlockDocumentTitleNode,
} from './extensions/BlockDocumentTitleNode';
import {
  BlockDocumentEditorContext,
  type BlockDocumentEditorChangeHandler,
  createDefaultBlockDocumentBlockId,
  hasUnnormalizedBlockDocumentIds,
  normalizeBlockDocumentContent,
  type BlockDocumentEditorContextValue,
} from './BlockDocumentEditorContext';

export type BlockDocumentEditorRootProps = PropsWithChildren<{
  documentId: string;
  value: BlockDocumentContent;
  onChange: BlockDocumentEditorChangeHandler;
  assets?: Record<string, DocumentAsset>;
  syncRevision?: number;
  syncSourceId?: string;
  readOnly?: boolean;
  generateBlockId?: () => string;
  title?: string;
  onTitleChange?: (title: string) => void;
  onEditorReady?: (editor: Editor) => void;
}>;

function stableStringify(value: unknown) {
  return JSON.stringify(value);
}

function textFromNode(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const candidate = node as {
    text?: unknown;
    content?: unknown;
  };
  if (typeof candidate.text === 'string') return candidate.text;
  if (!Array.isArray(candidate.content)) return '';
  return candidate.content.map((child) => textFromNode(child)).join('');
}

/**
 * Finds the position of a node with the given ID in the document.
 * Returns null if not found.
 */
function findNodePositionById(
  doc: {
    descendants: (callback: (node: any, pos: number) => boolean | void) => void;
  },
  nodeId: string,
): number | null {
  let foundPos: number | null = null;
  doc.descendants((node: any, pos: number) => {
    if (node.attrs?.id === nodeId) {
      foundPos = pos;
      return false; // Stop iteration
    }
  });
  return foundPos;
}

function createTitleNode(title: string) {
  return {
    type: BLOCK_DOCUMENT_TITLE_NODE_NAME,
    content: title ? [{type: 'text', text: title}] : undefined,
  };
}

function stripTitleNodes(value: BlockDocumentContent): BlockDocumentContent {
  return {
    ...value,
    content: value.content.filter(
      (node) => node.type !== BLOCK_DOCUMENT_TITLE_NODE_NAME,
    ),
  };
}

function createEditorContent(
  title: string,
  body: BlockDocumentContent,
): BlockDocumentContent {
  return {
    ...body,
    content: [createTitleNode(title), ...stripTitleNodes(body).content],
  };
}

function splitEditorContent(value: BlockDocumentContent) {
  const titleNode = value.content.find(
    (node) => node.type === BLOCK_DOCUMENT_TITLE_NODE_NAME,
  );
  return {
    title: textFromNode(titleNode),
    body: stripTitleNodes(value),
  };
}

function createEditorSourceId() {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (randomUUID) {
    return `block-document-editor:${randomUUID.call(globalThis.crypto)}`;
  }
  return `block-document-editor:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2)}`;
}

export const BlockDocumentEditorRoot: FC<BlockDocumentEditorRootProps> = ({
  documentId,
  value,
  onChange,
  assets = {},
  syncRevision,
  syncSourceId,
  readOnly = false,
  generateBlockId = createDefaultBlockDocumentBlockId,
  title = 'Untitled',
  onTitleChange,
  onEditorReady,
  children,
}) => {
  const onChangeRef = useRef(onChange);
  const onTitleChangeRef = useRef(onTitleChange);
  const titleRef = useRef(title);
  const currentBodyContentKeyRef = useRef<string | null>(null);
  const generateBlockIdRef = useRef(generateBlockId);
  const editorSourceIdRef = useRef(createEditorSourceId());
  const lastEmittedContentKeyRef = useRef<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onTitleChangeRef.current = onTitleChange;
  }, [onTitleChange]);

  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  useEffect(() => {
    generateBlockIdRef.current = generateBlockId;
  }, [generateBlockId]);

  const valueKey = stableStringify(value);
  const normalizedValue = useMemo(
    () =>
      normalizeBlockDocumentContent(stripTitleNodes(value), generateBlockId),
    [generateBlockId, value],
  );
  const normalizedValueKey = stableStringify(normalizedValue);

  useEffect(() => {
    currentBodyContentKeyRef.current = normalizedValueKey;
  }, [normalizedValueKey]);

  const editorValue = useMemo(
    () => createEditorContent(title, normalizedValue),
    [normalizedValue, title],
  );
  const editorValueKey = stableStringify(editorValue);

  const extensions = useMemo(() => {
    const documentExtensions = [
      StarterKit.configure({link: false}),
      BlockDocumentTitleNode,
      Link.configure({openOnClick: false}),
      TaskList,
      TaskItem.configure({nested: true}),
      Table.configure({resizable: true}),
      TableRow,
      TableHeader,
      TableCell,
      BlockDocumentImageNode,
      BlockDocumentChartImageNode,
      BlockDocumentChartNode,
      BlockDocumentStatefulBlockNode,
    ];
    return [
      BlockDocumentBlockIdExtension.configure({
        types: getBlockNodeExtensionNames(documentExtensions).filter(
          (name) => name !== BLOCK_DOCUMENT_TITLE_NODE_NAME,
        ),
      }),
      ...documentExtensions,
    ];
  }, []);

  const editor = useEditor(
    {
      extensions,
      content: editorValue,
      editable: !readOnly,
      immediatelyRender: false,
      onUpdate: ({editor}) => {
        const editorContent = editor.getJSON() as BlockDocumentContent;
        const {title: nextTitle, body} = splitEditorContent(editorContent);
        if (nextTitle !== titleRef.current) {
          onTitleChangeRef.current?.(nextTitle);
        }
        const nextContent = normalizeBlockDocumentContent(body, () =>
          generateBlockIdRef.current(),
        );
        const nextContentKey = stableStringify(nextContent);
        if (nextContentKey !== currentBodyContentKeyRef.current) {
          lastEmittedContentKeyRef.current = nextContentKey;
          onChangeRef.current(nextContent, {
            origin: 'editor',
            sourceId: editorSourceIdRef.current,
          });
        }
      },
      editorProps: {
        attributes: {
          class:
            'prose prose-sm dark:prose-invert prose-a:text-primary prose-a:underline-offset-2 prose-headings:tracking-normal prose-h1:my-3 prose-h1:text-2xl prose-h1:leading-tight prose-h2:my-2 prose-h2:text-xl prose-h2:leading-snug prose-h3:my-2 prose-h3:text-lg prose-h3:leading-snug prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-li:leading-6 prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:text-foreground prose-pre:my-3 prose-pre:rounded-md prose-pre:px-3 prose-pre:py-2 [&_li>p]:my-0 [&>p]:min-h-6 [&>h1[data-type=block-document-title]]:!my-0 [&>h1[data-type=block-document-title]]:!text-4xl [&>h1[data-type=block-document-title]]:!leading-tight max-w-none min-h-full pt-10 pr-6 pb-5 pl-24 focus:outline-none',
        },
        handleDOMEvents: {
          blur: (view) => {
            const {title} = splitEditorContent(
              view.state.doc.toJSON() as BlockDocumentContent,
            );
            if (!title.trim()) {
              onTitleChangeRef.current?.('Untitled');
            }
            return false;
          },
        },
      },
    },
    [documentId],
  );

  useEffect(() => {
    if (valueKey !== normalizedValueKey) {
      onChangeRef.current(normalizedValue);
    }
  }, [normalizedValue, normalizedValueKey, valueKey]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) {
      return;
    }
    const editorContent = editor.getJSON() as BlockDocumentContent;
    if (stableStringify(editorContent) === editorValueKey) {
      return;
    }
    const {title: editorTitle, body: editorBodyContent} =
      splitEditorContent(editorContent);
    const titleChanged = editorTitle !== title;
    const isOwnStoreEcho =
      syncSourceId === editorSourceIdRef.current &&
      lastEmittedContentKeyRef.current === normalizedValueKey;
    const shouldBackfillEditorIds =
      isOwnStoreEcho && hasUnnormalizedBlockDocumentIds(editorBodyContent);

    if (isOwnStoreEcho && !shouldBackfillEditorIds && !titleChanged) {
      return;
    }

    if (editor.isDestroyed) {
      return;
    }

    const {state} = editor;
    const selection = state.selection;
    const wasNodeSelection = selection instanceof NodeSelection;
    const selectedNodeId = wasNodeSelection ? selection.node.attrs.id : null;

    // Build transaction to replace content and restore selection atomically
    const tr = state.tr;
    const newDoc = editor.schema.nodeFromJSON(editorValue);
    tr.replaceWith(0, state.doc.content.size, newDoc.content);

    // Restore selection in the same transaction to prevent intermediate selectionUpdate events
    // NodeSelection: always restore (block selections should persist even when editor loses focus)
    // TextSelection: only restore if editor was focused (avoid unexpected cursor movement)
    if (wasNodeSelection && selectedNodeId) {
      const nodePos = findNodePositionById(tr.doc, selectedNodeId);
      if (nodePos !== null) {
        tr.setSelection(NodeSelection.create(tr.doc, nodePos));
      }
    } else if (editor.isFocused) {
      const from = Math.min(selection.from, tr.doc.content.size);
      const to = Math.min(selection.to, tr.doc.content.size);
      tr.setSelection(TextSelection.create(tr.doc, from, to));
    }

    editor.view.dispatch(tr);
  }, [
    editor,
    editorValue,
    editorValueKey,
    normalizedValueKey,
    syncRevision,
    syncSourceId,
    title,
  ]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) {
      return;
    }
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  const clearSelection = useBlockSettingsStore(
    (state) => state.blockSettings.clearSelection,
  );

  useEffect(() => {
    return () => {
      // Clear custom selection when editor unmounts
      clearSelection?.();
    };
    // Only clear on unmount, not when documentId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contextValue: BlockDocumentEditorContextValue = useMemo(
    () => ({
      editor,
      documentId,
      value: normalizedValue,
      assets,
      onChange,
      readOnly,
      generateBlockId: () => generateBlockIdRef.current(),
    }),
    [assets, documentId, editor, normalizedValue, onChange, readOnly],
  );

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  return (
    <BlockDocumentEditorContext.Provider value={contextValue}>
      <div className="flex h-full min-h-0 flex-col">{children}</div>
    </BlockDocumentEditorContext.Provider>
  );
};
