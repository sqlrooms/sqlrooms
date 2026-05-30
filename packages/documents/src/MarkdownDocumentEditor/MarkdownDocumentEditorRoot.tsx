import Link from '@tiptap/extension-link';
import {Table} from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import {Markdown} from '@tiptap/markdown';
import {useEditor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {FC, PropsWithChildren, useEffect, useMemo, useRef, useState} from 'react';
import {
  MarkdownDocumentEditorContext,
  type MarkdownDocumentEditorContextValue,
} from './MarkdownDocumentEditorContext';

export type MarkdownDocumentEditorMode = 'rich' | 'source';

export type MarkdownDocumentEditorRootProps = PropsWithChildren<{
  value: string;
  onChange: (value: string) => void;
  sourcePanelOpen?: boolean;
  onSourcePanelOpenChange?: (open: boolean) => void;
  /** @deprecated Use sourcePanelOpen. Source mode now means the Markdown panel is open. */
  mode?: MarkdownDocumentEditorMode;
  /** @deprecated Use onSourcePanelOpenChange. */
  onModeChange?: (mode: MarkdownDocumentEditorMode) => void;
  readOnly?: boolean;
}>;

export const MarkdownDocumentEditorRoot: FC<
  MarkdownDocumentEditorRootProps
> = ({
  value,
  onChange,
  sourcePanelOpen: controlledSourcePanelOpen,
  onSourcePanelOpenChange,
  mode: controlledMode,
  onModeChange,
  readOnly = false,
  children,
}) => {
  const [uncontrolledSourcePanelOpen, setUncontrolledSourcePanelOpen] =
    useState(controlledMode === 'source');

  const sourcePanelOpen =
    controlledSourcePanelOpen ??
    (controlledMode
      ? controlledMode === 'source'
      : uncontrolledSourcePanelOpen);

  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const extensions = useMemo(
    () => [
      StarterKit.configure({link: false}),
      Link.configure({openOnClick: false}),
      TaskList,
      TaskItem.configure({nested: true}),
      Table.configure({resizable: true}),
      TableRow,
      TableHeader,
      TableCell,
      Markdown.configure({
        markedOptions: {gfm: true},
      }),
    ],
    [],
  );

  const editor = useEditor(
    {
      extensions,
      content: value,
      contentType: 'markdown',
      editable: !readOnly,
      immediatelyRender: false,
      onUpdate: ({editor}) => {
        onChangeRef.current(editor.getMarkdown());
      },
      editorProps: {
        attributes: {
          class:
            'prose prose-sm dark:prose-invert prose-a:text-primary prose-a:underline-offset-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-li:leading-6 prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:text-foreground prose-pre:my-3 prose-pre:rounded-md prose-pre:px-3 prose-pre:py-2 [&_li>p]:my-0 max-w-none min-h-full px-6 py-5 focus:outline-none',
        },
      },
    },
    [],
  );

  useEffect(() => {
    if (!editor || editor.getMarkdown() === value) {
      return;
    }

    editor.commands.setContent(value, {contentType: 'markdown'});
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  const setSourcePanelOpen = (open: boolean) => {
    if (open === sourcePanelOpen) {
      return;
    }

    setUncontrolledSourcePanelOpen(open);
    onSourcePanelOpenChange?.(open);
    onModeChange?.(open ? 'source' : 'rich');
  };

  const contextValue: MarkdownDocumentEditorContextValue = {
    editor,
    value,
    onChange,
    sourcePanelOpen,
    setSourcePanelOpen,
    readOnly,
  };

  return (
    <MarkdownDocumentEditorContext.Provider value={contextValue}>
      <div className="flex h-full min-h-0 flex-col">{children}</div>
    </MarkdownDocumentEditorContext.Provider>
  );
};
