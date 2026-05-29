import Link from '@tiptap/extension-link';
import {Table} from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import {useEditor} from '@tiptap/react';
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
import {
  BlockDocumentBlockIdExtension,
  getBlockNodeExtensionNames,
} from './extensions/BlockDocumentBlockIdExtension';
import {BlockDocumentChartImageNode} from './extensions/BlockDocumentChartImageNode';
import {BlockDocumentChartNode} from './extensions/BlockDocumentChartNode';
import {BlockDocumentImageNode} from './extensions/BlockDocumentImageNode';
import {BlockDocumentRichTextNode} from './extensions/BlockDocumentRichTextNode';
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
      BlockDocumentRichTextNode,
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

  const editor = useEditor({
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
          'prose prose-sm dark:prose-invert prose-a:text-primary prose-a:underline-offset-2 prose-headings:tracking-normal prose-h1:my-3 prose-h1:text-2xl prose-h1:leading-tight prose-h2:my-2 prose-h2:text-xl prose-h2:leading-snug prose-h3:my-2 prose-h3:text-lg prose-h3:leading-snug prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-li:leading-6 prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:text-foreground prose-pre:my-3 prose-pre:rounded-md prose-pre:px-3 prose-pre:py-2 [&_li>p]:my-0 [&>p]:min-h-6 [&>h1[data-type=block-document-title]]:!my-0 [&>h1[data-type=block-document-title]]:!text-4xl [&>h1[data-type=block-document-title]]:!leading-tight max-w-none min-h-full pt-10 pr-6 pb-5 pl-16 focus:outline-none',
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
  });

  useEffect(() => {
    if (valueKey !== normalizedValueKey) {
      onChangeRef.current(normalizedValue);
    }
  }, [normalizedValue, normalizedValueKey, valueKey]);

  useEffect(() => {
    if (!editor) {
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
    const selection = editor.state.selection;
    const restoreSelection = editor.isFocused;
    editor.commands.setContent(editorValue, {emitUpdate: false});
    if (restoreSelection) {
      editor.commands.setTextSelection({
        from: selection.from,
        to: selection.to,
      });
    }
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
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  const contextValue: BlockDocumentEditorContextValue = {
    editor,
    documentId,
    value: normalizedValue,
    assets,
    onChange,
    readOnly,
    generateBlockId: () => generateBlockIdRef.current(),
  };

  return (
    <BlockDocumentEditorContext.Provider value={contextValue}>
      <div className="flex h-full min-h-0 flex-col">{children}</div>
    </BlockDocumentEditorContext.Provider>
  );
};
