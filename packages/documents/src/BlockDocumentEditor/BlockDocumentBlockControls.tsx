import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
} from '@sqlrooms/ui';
import type {Editor} from '@tiptap/react';
import {
  BarChart3Icon,
  CheckSquareIcon,
  Code2Icon,
  GripVerticalIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  PilcrowIcon,
  PlusIcon,
  QuoteIcon,
  Rows3Icon,
  Trash2Icon,
} from 'lucide-react';
import {
  type DragEvent,
  type FC,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type BlockDocumentStatefulBlockType,
  useBlockDocumentStatefulBlockTypes,
} from '../BlockDocumentStatefulBlockRendererContext';
import {useBlockDocumentEditorContext} from './BlockDocumentEditorContext';

type BlockControlState = {
  element: HTMLElement;
  pos: number;
  top: number;
};

type DraggableNode = NonNullable<ReturnType<Editor['state']['doc']['nodeAt']>>;

type BlockDocumentBlockControlsProps = {
  scrollElement: HTMLElement | null;
};

type BlockMenuItem = {
  label: string;
  description: string;
  icon: FC<{className?: string}>;
  createNode: (id: string) => Record<string, unknown>;
};

type InsertPlacement = 'before' | 'after';

function labelFromArtifactType(artifactType: string) {
  return artifactType
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function labelFromBlockType(blockType: string) {
  return labelFromArtifactType(blockType);
}

function directEditorChild(
  editorElement: HTMLElement,
  target: EventTarget | null,
): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  let node: HTMLElement | null = target;
  while (node && node.parentElement !== editorElement) {
    node = node.parentElement;
  }
  return node?.parentElement === editorElement ? node : null;
}

function getNodeAt(editor: Editor, pos: number) {
  return editor.state.doc.nodeAt(pos);
}

function getBlockPos(editor: Editor, element: HTMLElement) {
  try {
    const pos = editor.view.posAtDOM(element, 0);
    const resolvedPos = editor.state.doc.resolve(pos);
    return resolvedPos.depth > 0 ? resolvedPos.before(1) : pos;
  } catch {
    return null;
  }
}

function isPointerInElementRow(event: MouseEvent, element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return event.clientY >= rect.top && event.clientY <= rect.bottom;
}

function buildStatefulBlockMenuItems(
  blockTypes: BlockDocumentStatefulBlockType[],
): BlockMenuItem[] {
  return blockTypes.map((blockType) => {
    const label = blockType.label ?? labelFromBlockType(blockType.blockType);
    return {
      label,
      description: blockType.description ?? `Insert ${label}`,
      icon: Rows3Icon,
      createNode:
        blockType.createNode ??
        ((id: string) => ({
          type: 'blockDocumentStatefulBlock',
          attrs: {
            id,
            blockType: blockType.blockType,
            blockInstanceId: id,
            ownership: 'owned',
            title: label,
            caption: '',
          },
        })),
    };
  });
}

function buildTextBlockMenuItems(): BlockMenuItem[] {
  return [
    {
      label: 'Paragraph',
      description: 'Plain text',
      icon: PilcrowIcon,
      createNode: (id) => ({
        type: 'paragraph',
        attrs: {id},
      }),
    },
    {
      label: 'Heading 1',
      description: 'Large section heading',
      icon: Heading1Icon,
      createNode: (id) => ({
        type: 'heading',
        attrs: {id, level: 1},
        content: [{type: 'text', text: 'Heading'}],
      }),
    },
    {
      label: 'Heading 2',
      description: 'Medium section heading',
      icon: Heading2Icon,
      createNode: (id) => ({
        type: 'heading',
        attrs: {id, level: 2},
        content: [{type: 'text', text: 'Heading'}],
      }),
    },
    {
      label: 'Heading 3',
      description: 'Small section heading',
      icon: Heading3Icon,
      createNode: (id) => ({
        type: 'heading',
        attrs: {id, level: 3},
        content: [{type: 'text', text: 'Heading'}],
      }),
    },
    {
      label: 'Bulleted list',
      description: 'List of items',
      icon: ListIcon,
      createNode: (id) => ({
        type: 'bulletList',
        attrs: {id},
        content: [
          {
            type: 'listItem',
            content: [{type: 'paragraph'}],
          },
        ],
      }),
    },
    {
      label: 'Numbered list',
      description: 'Ordered items',
      icon: ListOrderedIcon,
      createNode: (id) => ({
        type: 'orderedList',
        attrs: {id},
        content: [
          {
            type: 'listItem',
            content: [{type: 'paragraph'}],
          },
        ],
      }),
    },
    {
      label: 'Todo',
      description: 'Task checkbox',
      icon: CheckSquareIcon,
      createNode: (id) => ({
        type: 'taskList',
        attrs: {id},
        content: [
          {
            type: 'taskItem',
            attrs: {checked: false},
            content: [{type: 'paragraph'}],
          },
        ],
      }),
    },
    {
      label: 'Quote',
      description: 'Quoted text',
      icon: QuoteIcon,
      createNode: (id) => ({
        type: 'blockquote',
        attrs: {id},
        content: [{type: 'paragraph'}],
      }),
    },
    {
      label: 'Code',
      description: 'Code block',
      icon: Code2Icon,
      createNode: (id) => ({
        type: 'codeBlock',
        attrs: {id},
      }),
    },
  ];
}

function buildMediaBlockMenuItems(
  statefulBlockTypes: BlockDocumentStatefulBlockType[],
): BlockMenuItem[] {
  return [
    {
      label: 'Divider',
      description: 'Horizontal rule',
      icon: MinusIcon,
      createNode: (id) => ({
        type: 'horizontalRule',
        attrs: {id},
      }),
    },
    {
      label: 'Image',
      description: 'Document image block',
      icon: ImageIcon,
      createNode: (id) => ({
        type: 'blockDocumentImage',
        attrs: {id, assetId: '', caption: ''},
      }),
    },
    {
      label: 'Chart',
      description: 'Standalone chart block',
      icon: BarChart3Icon,
      createNode: (id) => ({
        type: 'blockDocumentChart',
        attrs: {id, tableName: '', config: {}, caption: ''},
      }),
    },
    ...buildStatefulBlockMenuItems(statefulBlockTypes),
  ];
}

export const BlockDocumentBlockControls: FC<
  BlockDocumentBlockControlsProps
> = ({scrollElement}) => {
  const {editor, readOnly, generateBlockId} = useBlockDocumentEditorContext();
  const statefulBlockTypes = useBlockDocumentStatefulBlockTypes();
  const [activeBlock, setActiveBlock] = useState<BlockControlState | null>(
    null,
  );
  const [insertMenuOpen, setInsertMenuOpen] =
    useState<InsertPlacement | null>(null);
  const [handleMenuOpen, setHandleMenuOpen] = useState(false);
  const dragSourceRef = useRef<{pos: number; node: DraggableNode} | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const textMenuItems = useMemo(() => buildTextBlockMenuItems(), []);
  const mediaMenuItems = useMemo(
    () => buildMediaBlockMenuItems(statefulBlockTypes),
    [statefulBlockTypes],
  );
  const menuOpen = insertMenuOpen != null || handleMenuOpen;

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current == null) return;
    window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  }, []);

  const scheduleHide = useCallback(() => {
    if (menuOpen) return;
    cancelHide();
    hideTimerRef.current = window.setTimeout(() => {
      setActiveBlock(null);
      hideTimerRef.current = null;
    }, 180);
  }, [cancelHide, menuOpen]);

  const updateActiveBlock = useCallback(
    (element: HTMLElement | null) => {
      if (!editor || !scrollElement || !element) {
        if (!menuOpen) scheduleHide();
        return;
      }
      const pos = getBlockPos(editor, element);
      if (pos == null || !getNodeAt(editor, pos)) {
        if (!menuOpen) scheduleHide();
        return;
      }
      cancelHide();
      const elementRect = element.getBoundingClientRect();
      const scrollRect = scrollElement.getBoundingClientRect();
      setActiveBlock({
        element,
        pos,
        top:
          elementRect.top -
          scrollRect.top +
          scrollElement.scrollTop +
          elementRect.height / 2,
      });
    },
    [cancelHide, editor, menuOpen, scheduleHide, scrollElement],
  );

  useEffect(() => {
    if (!editor || !scrollElement || readOnly) return;
    const editorElement = editor.view.dom as HTMLElement;

    const handleMouseMove = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        controlsRef.current?.contains(event.target)
      ) {
        cancelHide();
        return;
      }
      const hoveredBlock = directEditorChild(editorElement, event.target);
      if (hoveredBlock) {
        updateActiveBlock(hoveredBlock);
        return;
      }
      if (activeBlock && isPointerInElementRow(event, activeBlock.element)) {
        updateActiveBlock(activeBlock.element);
        return;
      }
      updateActiveBlock(null);
    };
    const handleMouseLeave = () => scheduleHide();
    const handleScroll = () => {
      if (activeBlock) updateActiveBlock(activeBlock.element);
    };

    scrollElement.addEventListener('mousemove', handleMouseMove);
    scrollElement.addEventListener('mouseleave', handleMouseLeave);
    scrollElement.addEventListener('scroll', handleScroll, {passive: true});
    window.addEventListener('resize', handleScroll);

    return () => {
      cancelHide();
      scrollElement.removeEventListener('mousemove', handleMouseMove);
      scrollElement.removeEventListener('mouseleave', handleMouseLeave);
      scrollElement.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [
    activeBlock,
    cancelHide,
    editor,
    menuOpen,
    readOnly,
    scheduleHide,
    scrollElement,
    updateActiveBlock,
  ]);

  const insertBlockRelativeToActive = useCallback(
    (createNode: BlockMenuItem['createNode'], placement: InsertPlacement) => {
      if (!editor || !activeBlock) return;
      const node = getNodeAt(editor, activeBlock.pos);
      if (!node) return;
      const insertPos =
        placement === 'before'
          ? activeBlock.pos
          : activeBlock.pos + node.nodeSize;
      editor
        .chain()
        .focus()
        .insertContentAt(insertPos, createNode(generateBlockId()))
        .run();
      setInsertMenuOpen(null);
    },
    [activeBlock, editor, generateBlockId],
  );

  const deleteActiveBlock = useCallback(() => {
    if (!editor || !activeBlock) return;
    const node = getNodeAt(editor, activeBlock.pos);
    const paragraph = editor.schema.nodes.paragraph;
    if (!node || !paragraph) return;

    const tr = editor.state.tr.delete(
      activeBlock.pos,
      activeBlock.pos + node.nodeSize,
    );
    if (tr.doc.childCount === 0) {
      tr.insert(0, paragraph.create({id: generateBlockId()}));
    }
    editor.view.dispatch(tr.scrollIntoView());
    editor.commands.focus();
    setActiveBlock(null);
  }, [activeBlock, editor, generateBlockId]);

  const handlePlusMouseDown = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const handleDragStart = (event: DragEvent<HTMLButtonElement>) => {
    if (!editor || !activeBlock) return;
    const node = getNodeAt(editor, activeBlock.pos);
    if (!node) return;
    dragSourceRef.current = {pos: activeBlock.pos, node};
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(
      'application/x-sqlrooms-block-document-block',
      'move',
    );
  };

  const renderMenuItem = (
    item: BlockMenuItem,
    placement: InsertPlacement,
  ) => (
    <DropdownMenuItem
      key={item.label}
      className="items-start gap-2"
      onSelect={() => insertBlockRelativeToActive(item.createNode, placement)}
    >
      <item.icon className="mt-0.5 h-4 w-4" />
      <span className="grid gap-0.5">
        <span>{item.label}</span>
        <span className="text-muted-foreground text-xs">
          {item.description}
        </span>
      </span>
    </DropdownMenuItem>
  );

  const renderInsertMenuContent = (placement: InsertPlacement) => (
    <DropdownMenuContent align="center" side="right" className="w-60">
      <DropdownMenuLabel>
        Insert {placement === 'before' ? 'above' : 'below'}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="gap-2">
          <PilcrowIcon className="h-4 w-4" />
          Text
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-60">
          {textMenuItems.map((item) => renderMenuItem(item, placement))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      {mediaMenuItems.map((item) => renderMenuItem(item, placement))}
    </DropdownMenuContent>
  );

  const renderAddButton = (placement: InsertPlacement) => (
    <DropdownMenu
      open={insertMenuOpen === placement}
      onOpenChange={(open) => setInsertMenuOpen(open ? placement : null)}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="pointer-events-auto h-6 w-6 shrink-0 rounded-md opacity-70 hover:opacity-100"
              aria-label={
                placement === 'before' ? 'Add block above' : 'Add block below'
              }
              onMouseDown={handlePlusMouseDown}
            >
              <PlusIcon className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent
          align="center"
          side="right"
          className="bg-popover text-popover-foreground border-border border px-2.5 py-1.5 text-xs shadow-md"
        >
          {placement === 'before' ? 'Add above' : 'Add below'}
        </TooltipContent>
      </Tooltip>
      {renderInsertMenuContent(placement)}
    </DropdownMenu>
  );

  useEffect(() => {
    if (!editor || !scrollElement || readOnly) return;
    const editorElement = editor.view.dom as HTMLElement;

    const handleDragOver = (event: globalThis.DragEvent) => {
      if (!dragSourceRef.current) return;
      event.preventDefault();
      event.dataTransfer!.dropEffect = 'move';
    };

    const handleDrop = (event: globalThis.DragEvent) => {
      const source = dragSourceRef.current;
      if (!source) return;
      event.preventDefault();

      const targetElement = directEditorChild(editorElement, event.target);
      const targetPos = targetElement
        ? getBlockPos(editor, targetElement)
        : null;
      const targetNode =
        targetPos == null ? null : getNodeAt(editor, targetPos);
      if (targetPos == null || !targetNode) {
        dragSourceRef.current = null;
        return;
      }

      const targetRect = targetElement!.getBoundingClientRect();
      const insertAfter =
        event.clientY > targetRect.top + targetRect.height / 2;
      let insertPos = targetPos + (insertAfter ? targetNode.nodeSize : 0);
      if (insertPos > source.pos) {
        insertPos -= source.node.nodeSize;
      }

      if (insertPos !== source.pos) {
        const tr = editor.state.tr
          .delete(source.pos, source.pos + source.node.nodeSize)
          .insert(insertPos, source.node);
        editor.view.dispatch(tr.scrollIntoView());
      }
      dragSourceRef.current = null;
    };

    const handleDragEnd = () => {
      dragSourceRef.current = null;
    };

    editorElement.addEventListener('dragover', handleDragOver);
    editorElement.addEventListener('drop', handleDrop);
    window.addEventListener('dragend', handleDragEnd);

    return () => {
      editorElement.removeEventListener('dragover', handleDragOver);
      editorElement.removeEventListener('drop', handleDrop);
      window.removeEventListener('dragend', handleDragEnd);
    };
  }, [editor, readOnly, scrollElement]);

  if (!editor || readOnly || !activeBlock) {
    return null;
  }

  return (
    <div
      ref={controlsRef}
      className="pointer-events-none absolute left-3 z-20 flex w-7 -translate-y-1/2 flex-col items-center gap-0.5"
      style={{top: activeBlock.top}}
    >
      <TooltipProvider>
        {renderAddButton('before')}
        <DropdownMenu open={handleMenuOpen} onOpenChange={setHandleMenuOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  draggable
                  className={cn(
                    'pointer-events-auto flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md opacity-70',
                    'hover:bg-accent hover:text-accent-foreground hover:opacity-100 active:cursor-grabbing',
                  )}
                  aria-label="Block options"
                  onMouseDown={handlePlusMouseDown}
                  onDragStart={handleDragStart}
                >
                  <GripVerticalIcon className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent
              align="start"
              side="bottom"
              className="bg-popover text-popover-foreground border-border border px-2.5 py-1.5 text-center text-xs shadow-md"
            >
              <div>
                <span className="font-medium">Drag</span>{' '}
                <span className="text-muted-foreground">to move</span>
              </div>
              <div>
                <span className="font-medium">Click</span>{' '}
                <span className="text-muted-foreground">to open menu</span>
              </div>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" side="right" className="w-44">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={deleteActiveBlock}
            >
              <Trash2Icon className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {renderAddButton('after')}
      </TooltipProvider>
    </div>
  );
};
