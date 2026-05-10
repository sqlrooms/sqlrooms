import {markdown} from '@codemirror/lang-markdown';
import {CodeMirrorEditor} from '@sqlrooms/codemirror';
import {Button, cn, ToggleGroup, ToggleGroupItem} from '@sqlrooms/ui';
import Link from '@tiptap/extension-link';
import {Table} from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import {Markdown} from '@tiptap/markdown';
import {EditorContent, type Editor, useEditor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  PilcrowIcon,
  QuoteIcon,
} from 'lucide-react';
import React, {useEffect, useMemo, useRef} from 'react';

export type MarkdownDocumentEditorMode = 'rich' | 'source';

export type MarkdownDocumentEditorProps = {
  value: string;
  onChange: (value: string) => void;
  mode?: MarkdownDocumentEditorMode;
  onModeChange?: (mode: MarkdownDocumentEditorMode) => void;
  className?: string;
  readOnly?: boolean;
};

export function MarkdownDocumentEditor({
  value,
  onChange,
  mode: controlledMode,
  onModeChange,
  className,
  readOnly = false,
}: MarkdownDocumentEditorProps) {
  const [uncontrolledMode, setUncontrolledMode] =
    React.useState<MarkdownDocumentEditorMode>('rich');
  const mode = controlledMode ?? uncontrolledMode;
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const extensions = useMemo(
    () => [
      StarterKit,
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

  const editor = useEditor({
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
          'prose prose-sm dark:prose-invert max-w-none min-h-full px-6 py-5 focus:outline-none',
      },
    },
  });

  useEffect(() => {
    if (!editor || mode !== 'rich') return;
    if (editor.getMarkdown() === value) return;
    editor.commands.setContent(value, {contentType: 'markdown'});
  }, [editor, mode, value]);

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  const setMode = (nextMode: MarkdownDocumentEditorMode) => {
    if (!nextMode || nextMode === mode) return;
    setUncontrolledMode(nextMode);
    onModeChange?.(nextMode);
  };

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="border-border flex shrink-0 items-center gap-1 border-b px-3 py-2">
        <RichToolbar editor={editor} disabled={readOnly || mode !== 'rich'} />
        <div className="flex-1" />
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(value) =>
            setMode(value as MarkdownDocumentEditorMode)
          }
          size="sm"
        >
          <ToggleGroupItem value="rich" aria-label="Rich text mode">
            Rich
          </ToggleGroupItem>
          <ToggleGroupItem value="source" aria-label="Markdown source mode">
            Markdown
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {mode === 'source' ? (
        <CodeMirrorEditor
          className="h-full min-h-0 flex-1"
          value={value}
          readOnly={readOnly}
          onChange={onChange}
          extensions={[markdown()]}
          options={{
            lineWrapping: true,
            foldGutter: false,
          }}
        />
      ) : (
        <EditorContent
          editor={editor}
          className="min-h-0 flex-1 overflow-auto"
        />
      )}
    </div>
  );
}

function RichToolbar({
  editor,
  disabled,
}: {
  editor: Editor | null;
  disabled: boolean;
}) {
  const tools = [
    {
      label: 'Paragraph',
      icon: PilcrowIcon,
      active: () => editor?.isActive('paragraph'),
      run: () => editor?.chain().focus().setParagraph().run(),
    },
    {
      label: 'Heading 1',
      icon: Heading1Icon,
      active: () => editor?.isActive('heading', {level: 1}),
      run: () => editor?.chain().focus().toggleHeading({level: 1}).run(),
    },
    {
      label: 'Heading 2',
      icon: Heading2Icon,
      active: () => editor?.isActive('heading', {level: 2}),
      run: () => editor?.chain().focus().toggleHeading({level: 2}).run(),
    },
    {
      label: 'Bold',
      icon: BoldIcon,
      active: () => editor?.isActive('bold'),
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: 'Italic',
      icon: ItalicIcon,
      active: () => editor?.isActive('italic'),
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: 'Code',
      icon: CodeIcon,
      active: () => editor?.isActive('code'),
      run: () => editor?.chain().focus().toggleCode().run(),
    },
    {
      label: 'Bullet list',
      icon: ListIcon,
      active: () => editor?.isActive('bulletList'),
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      label: 'Ordered list',
      icon: ListOrderedIcon,
      active: () => editor?.isActive('orderedList'),
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      label: 'Blockquote',
      icon: QuoteIcon,
      active: () => editor?.isActive('blockquote'),
      run: () => editor?.chain().focus().toggleBlockquote().run(),
    },
    {
      label: 'Link',
      icon: LinkIcon,
      active: () => editor?.isActive('link'),
      run: () => {
        const previous = editor?.getAttributes('link').href as
          | string
          | undefined;
        const href = window.prompt('Link URL', previous ?? '');
        if (href === null) return;
        if (!href) {
          editor?.chain().focus().unsetLink().run();
          return;
        }
        editor?.chain().focus().setLink({href}).run();
      },
    },
  ];

  return (
    <div className="flex items-center gap-1">
      {tools.map((tool) => {
        const Icon = tool.icon;
        return (
          <Button
            key={tool.label}
            type="button"
            size="icon"
            variant={tool.active() ? 'secondary' : 'ghost'}
            className="h-8 w-8"
            disabled={disabled || !editor}
            title={tool.label}
            onClick={() => tool.run()}
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
}
