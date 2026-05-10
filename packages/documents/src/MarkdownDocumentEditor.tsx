import {markdown} from '@codemirror/lang-markdown';
import {CodeMirrorEditor, createSqlroomsTheme} from '@sqlrooms/codemirror';
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ToggleGroup,
  ToggleGroupItem,
} from '@sqlrooms/ui';
import Link from '@tiptap/extension-link';
import {Table} from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import {Markdown} from '@tiptap/markdown';
import {
  EditorContent,
  type Editor,
  useEditor,
  useEditorState,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  BoldIcon,
  CodeIcon,
  ChevronDownIcon,
  FileCodeCornerIcon,
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
          'prose prose-sm dark:prose-invert prose-a:text-primary prose-a:underline-offset-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-li:leading-6 prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:text-foreground prose-pre:my-3 prose-pre:rounded-md prose-pre:px-3 prose-pre:py-2 [&_li>p]:my-0 max-w-none min-h-full px-6 py-5 focus:outline-none',
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
          extensions={[markdown(), createSqlroomsTheme()]}
          options={{
            lineNumbers: false,
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
  const activeState = useEditorState({
    editor,
    selector: ({editor}) => ({
      bold: editor?.isActive('bold') ?? false,
      italic: editor?.isActive('italic') ?? false,
      code: editor?.isActive('code') ?? false,
      codeBlock: editor?.isActive('codeBlock') ?? false,
      bulletList: editor?.isActive('bulletList') ?? false,
      orderedList: editor?.isActive('orderedList') ?? false,
      blockquote: editor?.isActive('blockquote') ?? false,
      link: editor?.isActive('link') ?? false,
      headingLevel:
        ([1, 2, 3, 4] as const).find((level) =>
          editor?.isActive('heading', {level}),
        ) ?? null,
    }),
  }) ?? {
    bold: false,
    italic: false,
    code: false,
    codeBlock: false,
    bulletList: false,
    orderedList: false,
    blockquote: false,
    link: false,
    headingLevel: null,
  };

  const tools = [
    {
      label: 'Bold',
      icon: BoldIcon,
      active: activeState.bold,
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: 'Italic',
      icon: ItalicIcon,
      active: activeState.italic,
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: 'Code',
      icon: CodeIcon,
      active: activeState.code,
      run: () => editor?.chain().focus().toggleCode().run(),
    },
    {
      label: 'Code block',
      icon: FileCodeCornerIcon,
      active: activeState.codeBlock,
      run: () => editor?.chain().focus().toggleCodeBlock().run(),
    },
    {
      label: 'Bullet list',
      icon: ListIcon,
      active: activeState.bulletList,
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      label: 'Ordered list',
      icon: ListOrderedIcon,
      active: activeState.orderedList,
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      label: 'Blockquote',
      icon: QuoteIcon,
      active: activeState.blockquote,
      run: () => editor?.chain().focus().toggleBlockquote().run(),
    },
    {
      label: 'Link',
      icon: LinkIcon,
      active: activeState.link,
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
      <HeadingDropdown
        editor={editor}
        activeHeadingLevel={activeState.headingLevel}
        disabled={disabled || !editor}
      />
      {tools.map((tool) => {
        const Icon = tool.icon;
        return (
          <Button
            key={tool.label}
            type="button"
            size="icon"
            variant={tool.active ? 'secondary' : 'ghost'}
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

function HeadingDropdown({
  editor,
  activeHeadingLevel,
  disabled,
}: {
  editor: Editor | null;
  activeHeadingLevel: 1 | 2 | 3 | 4 | null;
  disabled: boolean;
}) {
  const label = activeHeadingLevel ? `H${activeHeadingLevel}` : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={activeHeadingLevel ? 'secondary' : 'ghost'}
          className="h-8 gap-1 px-2"
          disabled={disabled}
          title="Text style"
        >
          {label ? (
            <span className="min-w-5 text-xs font-semibold">{label}</span>
          ) : (
            <PilcrowIcon className="h-4 w-4" />
          )}
          <ChevronDownIcon className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onClick={() => editor?.chain().focus().setParagraph().run()}
        >
          Paragraph
        </DropdownMenuItem>
        {[1, 2, 3, 4].map((level) => (
          <DropdownMenuItem
            key={level}
            onClick={() =>
              editor
                ?.chain()
                .focus()
                .toggleHeading({level: level as 1 | 2 | 3 | 4})
                .run()
            }
          >
            <span className="text-muted-foreground mr-2 font-mono text-xs">
              H{level}
            </span>
            Heading {level}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
