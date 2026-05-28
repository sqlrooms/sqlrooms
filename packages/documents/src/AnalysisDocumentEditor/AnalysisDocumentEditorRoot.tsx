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
import type {AnalysisDocumentContent} from '../AnalysisDocumentSliceConfig';
import type {DocumentAsset} from '../DocumentsSliceConfig';
import {AnalysisArtifactEmbedNode} from './extensions/AnalysisArtifactEmbedNode';
import {
  AnalysisBlockIdExtension,
  getBlockNodeExtensionNames,
} from './extensions/AnalysisBlockIdExtension';
import {AnalysisChartImageNode} from './extensions/AnalysisChartImageNode';
import {AnalysisChartNode} from './extensions/AnalysisChartNode';
import {AnalysisImageNode} from './extensions/AnalysisImageNode';
import {AnalysisRichTextNode} from './extensions/AnalysisRichTextNode';
import {
  AnalysisDocumentEditorContext,
  createDefaultAnalysisBlockId,
  normalizeAnalysisDocumentContent,
  type AnalysisDocumentEditorContextValue,
} from './AnalysisDocumentEditorContext';

export type AnalysisDocumentEditorRootProps = PropsWithChildren<{
  analysisId: string;
  value: AnalysisDocumentContent;
  onChange: (value: AnalysisDocumentContent) => void;
  assets?: Record<string, DocumentAsset>;
  readOnly?: boolean;
  generateBlockId?: () => string;
}>;

function stableStringify(value: unknown) {
  return JSON.stringify(value);
}

function hasMissingTopLevelBlockIds(value: AnalysisDocumentContent) {
  return value.content.some((node) => typeof node.attrs?.id !== 'string');
}

export const AnalysisDocumentEditorRoot: FC<
  AnalysisDocumentEditorRootProps
> = ({
  analysisId,
  value,
  onChange,
  assets = {},
  readOnly = false,
  generateBlockId = createDefaultAnalysisBlockId,
  children,
}) => {
  const onChangeRef = useRef(onChange);
  const generateBlockIdRef = useRef(generateBlockId);
  const lastEmittedContentKeyRef = useRef<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    generateBlockIdRef.current = generateBlockId;
  }, [generateBlockId]);

  const valueKey = stableStringify(value);
  const normalizedValue = useMemo(
    () => normalizeAnalysisDocumentContent(value, generateBlockId),
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
      AnalysisRichTextNode,
      AnalysisImageNode,
      AnalysisChartImageNode,
      AnalysisChartNode,
      AnalysisArtifactEmbedNode,
    ];
    return [
      AnalysisBlockIdExtension.configure({
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
      const nextContent = normalizeAnalysisDocumentContent(
        editor.getJSON() as AnalysisDocumentContent,
        () => generateBlockIdRef.current(),
      );
      lastEmittedContentKeyRef.current = stableStringify(nextContent);
      onChangeRef.current(nextContent);
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
    const editorContent = editor.getJSON() as AnalysisDocumentContent;
    if (stableStringify(editorContent) === normalizedValueKey) {
      return;
    }
    const shouldBackfillEditorIds =
      lastEmittedContentKeyRef.current === normalizedValueKey &&
      hasMissingTopLevelBlockIds(editorContent);
    if (
      lastEmittedContentKeyRef.current === normalizedValueKey &&
      !shouldBackfillEditorIds
    ) {
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
  }, [editor, normalizedValue, normalizedValueKey]);

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  const contextValue: AnalysisDocumentEditorContextValue = {
    editor,
    analysisId,
    value: normalizedValue,
    assets,
    onChange,
    readOnly,
    generateBlockId: () => generateBlockIdRef.current(),
  };

  return (
    <AnalysisDocumentEditorContext.Provider value={contextValue}>
      <div className="flex h-full min-h-0 flex-col">{children}</div>
    </AnalysisDocumentEditorContext.Provider>
  );
};
