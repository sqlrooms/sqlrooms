import {Button} from '@sqlrooms/ui';
import type {Editor} from '@tiptap/react';
import {useEditorState} from '@tiptap/react';
import {
  BoldIcon,
  CodeIcon,
  FileCodeCornerIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
} from 'lucide-react';
import React, {FC} from 'react';
import {HeadingDropdown} from './HeadingDropdown';
import {LinkInputDialog} from './LinkInputDialog';

export type RichToolbarProps = {
  editor: Editor | null;
  disabled: boolean;
};

export const RichToolbar: FC<RichToolbarProps> = ({editor, disabled}) => {
  const [linkDialogOpen, setLinkDialogOpen] = React.useState(false);
  const [linkHref, setLinkHref] = React.useState('');
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
        setLinkHref(previous ?? '');
        setLinkDialogOpen(true);
      },
    },
  ];

  const applyLink = (href: string) => {
    const nextHref = href.trim();
    if (!nextHref) {
      editor?.chain().focus().unsetLink().run();
    } else {
      editor?.chain().focus().setLink({href: nextHref}).run();
    }
    setLinkDialogOpen(false);
  };

  return (
    <>
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
      <LinkInputDialog
        open={linkDialogOpen}
        value={linkHref}
        onValueChange={setLinkHref}
        onOpenChange={setLinkDialogOpen}
        onConfirm={applyLink}
      />
    </>
  );
};
