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
import type {BlocksDocumentContent} from '../BlocksDocumentSliceConfig';
import type {DocumentAsset} from '../DocumentsSliceConfig';
import {BlocksDocumentArtifactEmbedNode} from './extensions/BlocksDocumentArtifactEmbedNode';
import {
  BlocksDocumentBlockIdExtension,
  getBlockNodeExtensionNames,
} from './extensions/BlocksDocumentBlockIdExtension';
import {BlocksDocumentChartImageNode} from './extensions/BlocksDocumentChartImageNode';
import {BlocksDocumentChartNode} from './extensions/BlocksDocumentChartNode';
import {BlocksDocumentImageNode} from './extensions/BlocksDocumentImageNode';
import {BlocksDocumentRichTextNode} from './extensions/BlocksDocumentRichTextNode';
import {BlocksDocumentStatefulBlockNode} from './extensions/BlocksDocumentStatefulBlockNode';
import {
  BlocksDocumentEditorContext,
  type BlocksDocumentEditorChangeHandler,
  createDefaultBlocksDocumentBlockId,
  normalizeBlocksDocumentContent,
  type BlocksDocumentEditorContextValue,
} from './BlocksDocumentEditorContext';

export type BlocksDocumentEditorRootProps = PropsWithChildren<{
  documentId: string;
  value: BlocksDocumentContent;
  onChange: BlocksDocumentEditorChangeHandler;
  assets?: Record<string, DocumentAsset>;
  syncRevision?: number;
  syncSourceId?: string;
  readOnly?: boolean;
  generateBlockId?: () => string;
}>;

function stableStringify(value: unknown) {
  return JSON.stringify(value);
}

function hasMissingTopLevelBlockIds(value: BlocksDocumentContent) {
  return value.content.some((node) => typeof node.attrs?.id !== 'string');
}

function createEditorSourceId() {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (randomUUID) {
    return `blocks-document-editor:${randomUUID.call(globalThis.crypto)}`;
  }
  return `blocks-document-editor:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2)}`;
}

export const BlocksDocumentEditorRoot: FC<
  BlocksDocumentEditorRootProps
> = ({
  documentId,
  value,
  onChange,
  assets = {},
  syncRevision,
  syncSourceId,
  readOnly = false,
  generateBlockId = createDefaultBlocksDocumentBlockId,
  children,
}) => {
  const onChangeRef = useRef(onChange);
  const generateBlockIdRef = useRef(generateBlockId);
  const editorSourceIdRef = useRef(createEditorSourceId());
  const lastEmittedContentKeyRef = useRef<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    generateBlockIdRef.current = generateBlockId;
  }, [generateBlockId]);

  const valueKey = stableStringify(value);
  const normalizedValue = useMemo(
    () => normalizeBlocksDocumentContent(value, generateBlockId),
    [generateBlockId, value],
  );
  const normalizedValueKey = stableStringify(normalizedValue);

  const extensions = useMemo(() => {
    const documentExtensions = [
      StarterKit.configure({link: false}),
      Link.configure({openOnClick: false}),
      TaskList,
      TaskItem.configure({nested: true}),
      Table.configure({resizable: true}),
      TableRow,
      TableHeader,
      TableCell,
      BlocksDocumentRichTextNode,
      BlocksDocumentImageNode,
      BlocksDocumentChartImageNode,
      BlocksDocumentChartNode,
      BlocksDocumentArtifactEmbedNode,
      BlocksDocumentStatefulBlockNode,
    ];
    return [
      BlocksDocumentBlockIdExtension.configure({
        types: getBlockNodeExtensionNames(documentExtensions),
      }),
      ...documentExtensions,
    ];
  }, []);

  const editor = useEditor({
    extensions,
    content: normalizedValue,
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({editor}) => {
      const nextContent = normalizeBlocksDocumentContent(
        editor.getJSON() as BlocksDocumentContent,
        () => generateBlockIdRef.current(),
      );
      lastEmittedContentKeyRef.current = stableStringify(nextContent);
      onChangeRef.current(nextContent, {
        origin: 'editor',
        sourceId: editorSourceIdRef.current,
      });
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert prose-a:text-primary prose-a:underline-offset-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-li:leading-6 prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:text-foreground prose-pre:my-3 prose-pre:rounded-md prose-pre:px-3 prose-pre:py-2 [&_li>p]:my-0 [&>p]:min-h-6 max-w-none min-h-full py-5 pr-6 pl-16 focus:outline-none',
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
    const editorContent = editor.getJSON() as BlocksDocumentContent;
    if (stableStringify(editorContent) === normalizedValueKey) {
      return;
    }
    const isOwnStoreEcho =
      syncSourceId === editorSourceIdRef.current &&
      lastEmittedContentKeyRef.current === normalizedValueKey;
    const shouldBackfillEditorIds =
      isOwnStoreEcho && hasMissingTopLevelBlockIds(editorContent);
    if (isOwnStoreEcho && !shouldBackfillEditorIds) {
      return;
    }
    const selection = editor.state.selection;
    const restoreSelection = editor.isFocused;
    editor.commands.setContent(normalizedValue, {emitUpdate: false});
    if (restoreSelection) {
      editor.commands.setTextSelection({
        from: selection.from,
        to: selection.to,
      });
    }
  }, [editor, normalizedValue, normalizedValueKey, syncRevision, syncSourceId]);

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  const contextValue: BlocksDocumentEditorContextValue = {
    editor,
    documentId,
    value: normalizedValue,
    assets,
    onChange,
    readOnly,
    generateBlockId: () => generateBlockIdRef.current(),
  };

  return (
    <BlocksDocumentEditorContext.Provider value={contextValue}>
      <div className="flex h-full min-h-0 flex-col">{children}</div>
    </BlocksDocumentEditorContext.Provider>
  );
};
