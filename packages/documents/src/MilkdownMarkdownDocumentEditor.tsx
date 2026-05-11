import {markdown} from '@codemirror/lang-markdown';
import {CodeMirrorEditor, createSqlroomsTheme} from '@sqlrooms/codemirror';
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sqlrooms/ui';
import {
  defaultValueCtx,
  type CmdKey,
  Editor,
  editorViewOptionsCtx,
  rootCtx,
} from '@milkdown/kit/core';
import {history} from '@milkdown/kit/plugin/history';
import {listener, listenerCtx} from '@milkdown/kit/plugin/listener';
import {
  commonmark,
  createCodeBlockCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
  toggleStrongCommand,
  turnIntoTextCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from '@milkdown/kit/preset/commonmark';
import {gfm, insertTableCommand} from '@milkdown/kit/preset/gfm';
import {callCommand, getMarkdown, replaceAll} from '@milkdown/kit/utils';
import {
  Milkdown,
  MilkdownProvider,
  useEditor,
  useInstance,
} from '@milkdown/react';
import {
  BoldIcon,
  ChevronDownIcon,
  CodeIcon,
  FileCodeCornerIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  PilcrowIcon,
  QuoteIcon,
  TableIcon,
  XIcon,
} from 'lucide-react';
import React, {useEffect, useRef, useState} from 'react';

export type MilkdownMarkdownDocumentEditorMode = 'rich' | 'source';

export type MilkdownMarkdownDocumentEditorProps = {
  value: string;
  onChange: (value: string) => void;
  sourcePanelOpen?: boolean;
  onSourcePanelOpenChange?: (open: boolean) => void;
  mode?: MilkdownMarkdownDocumentEditorMode;
  onModeChange?: (mode: MilkdownMarkdownDocumentEditorMode) => void;
  className?: string;
  readOnly?: boolean;
};

export function MilkdownMarkdownDocumentEditor(
  props: MilkdownMarkdownDocumentEditorProps,
) {
  return (
    <MilkdownProvider>
      <MilkdownMarkdownDocumentEditorInner {...props} />
    </MilkdownProvider>
  );
}

function MilkdownMarkdownDocumentEditorInner({
  value,
  onChange,
  sourcePanelOpen: controlledSourcePanelOpen,
  onSourcePanelOpenChange,
  mode: controlledMode,
  onModeChange,
  className,
  readOnly = false,
}: MilkdownMarkdownDocumentEditorProps) {
  const [uncontrolledSourcePanelOpen, setUncontrolledSourcePanelOpen] =
    useState(controlledMode === 'source');
  const sourcePanelOpen =
    controlledSourcePanelOpen ??
    (controlledMode
      ? controlledMode === 'source'
      : uncontrolledSourcePanelOpen);
  const onChangeRef = useRef(onChange);
  const readOnlyRef = useRef(readOnly);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    readOnlyRef.current = readOnly;
  }, [readOnly]);

  useEditor(
    (root) =>
      Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, value);
          ctx.update(editorViewOptionsCtx, (previous) => ({
            ...previous,
            editable: () => !readOnlyRef.current,
            attributes: {
              class: [
                'sqlrooms-milkdown-editor',
                'prose prose-sm dark:prose-invert max-w-none min-h-full px-6 py-5 focus:outline-none',
                'prose-a:text-primary prose-a:underline-offset-2',
                'prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-li:leading-6 [&_li>p]:my-0',
                'prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:text-foreground prose-pre:my-3 prose-pre:rounded-md prose-pre:px-3 prose-pre:py-2',
                readOnlyRef.current ? 'cursor-default' : '',
              ]
                .filter(Boolean)
                .join(' '),
            },
          }));
          ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, previous) => {
            if (markdown === previous) return;
            onChangeRef.current(markdown);
          });
        })
        .use(commonmark)
        .use(gfm)
        .use(history)
        .use(listener),
    [],
  );

  const [loading, getEditor] = useInstance();

  useEffect(() => {
    if (loading) return;
    const editor = getEditor();
    const current = editor.action(getMarkdown());
    if (current === value) return;
    editor.action(replaceAll(value, true));
  }, [getEditor, loading, value]);

  const setSourcePanelOpen = (open: boolean) => {
    if (open === sourcePanelOpen) return;
    setUncontrolledSourcePanelOpen(open);
    onSourcePanelOpenChange?.(open);
    onModeChange?.(open ? 'source' : 'rich');
  };

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="border-border flex shrink-0 items-center gap-1 border-b px-3 py-2">
        <MilkdownToolbar disabled={readOnly || loading} />
        <div className="flex-1" />
        <Button
          type="button"
          size="sm"
          variant={sourcePanelOpen ? 'secondary' : 'ghost'}
          className="h-8 gap-2"
          aria-pressed={sourcePanelOpen}
          title={
            sourcePanelOpen ? 'Hide Markdown source' : 'Show Markdown source'
          }
          onClick={() => setSourcePanelOpen(!sourcePanelOpen)}
        >
          <FileCodeCornerIcon className="h-4 w-4" />
          Markdown
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-h-[320px] flex-1 overflow-auto lg:min-h-0">
          <Milkdown />
        </div>
        {sourcePanelOpen ? (
          <div className="border-border flex min-h-[260px] flex-col border-t lg:min-h-0 lg:w-[42%] lg:min-w-[22rem] lg:border-t-0 lg:border-l">
            <div className="border-border flex h-10 shrink-0 items-center gap-2 border-b px-3">
              <FileCodeCornerIcon className="text-muted-foreground h-4 w-4" />
              <span className="text-sm font-medium">Markdown</span>
              <div className="flex-1" />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                title="Hide Markdown source"
                onClick={() => setSourcePanelOpen(false)}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
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
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MilkdownToolbar({disabled}: {disabled: boolean}) {
  const [loading, getEditor] = useInstance();

  const runCommand = (command: () => void) => {
    if (disabled || loading) return;
    command();
  };

  const call = <T,>(commandKey: CmdKey<T>, payload?: T) => {
    if (loading) return;
    getEditor().action(callCommand(commandKey, payload));
  };

  const tools = [
    {
      label: 'Bold',
      icon: BoldIcon,
      run: () => call(toggleStrongCommand.key),
    },
    {
      label: 'Italic',
      icon: ItalicIcon,
      run: () => call(toggleEmphasisCommand.key),
    },
    {
      label: 'Code',
      icon: CodeIcon,
      run: () => call(toggleInlineCodeCommand.key),
    },
    {
      label: 'Code block',
      icon: FileCodeCornerIcon,
      run: () => call(createCodeBlockCommand.key),
    },
    {
      label: 'Bullet list',
      icon: ListIcon,
      run: () => call(wrapInBulletListCommand.key),
    },
    {
      label: 'Ordered list',
      icon: ListOrderedIcon,
      run: () => call(wrapInOrderedListCommand.key),
    },
    {
      label: 'Blockquote',
      icon: QuoteIcon,
      run: () => call(wrapInBlockquoteCommand.key),
    },
    {
      label: 'Link',
      icon: LinkIcon,
      run: () => {
        const href = window.prompt('Link URL', '');
        if (href === null) return;
        call(toggleLinkCommand.key, {href: href || undefined});
      },
    },
    {
      label: 'Table',
      icon: TableIcon,
      run: () => call(insertTableCommand.key, {row: 3, col: 3}),
    },
  ];

  return (
    <div className="flex items-center gap-1">
      <MilkdownHeadingDropdown disabled={disabled} call={call} />
      {tools.map((tool) => {
        const Icon = tool.icon;
        return (
          <Button
            key={tool.label}
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            disabled={disabled}
            title={tool.label}
            onClick={() => runCommand(tool.run)}
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
}

function MilkdownHeadingDropdown({
  disabled,
  call,
}: {
  disabled: boolean;
  call: <T>(commandKey: CmdKey<T>, payload?: T) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 gap-1 px-2"
          disabled={disabled}
          title="Text style"
        >
          <PilcrowIcon className="h-4 w-4" />
          <ChevronDownIcon className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => call(turnIntoTextCommand.key)}>
          Paragraph
        </DropdownMenuItem>
        {[1, 2, 3, 4].map((level) => (
          <DropdownMenuItem
            key={level}
            onClick={() => call(wrapInHeadingCommand.key, level)}
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
