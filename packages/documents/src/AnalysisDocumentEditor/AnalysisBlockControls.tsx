import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from '@sqlrooms/ui';
import type {Editor} from '@tiptap/react';
import {
  BarChart3Icon,
  CheckSquareIcon,
  Code2Icon,
  GripVerticalIcon,
  Heading1Icon,
  ImageIcon,
  ListIcon,
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
  type AnalysisArtifactEmbedType,
  useAnalysisArtifactEmbedTypes,
} from '../AnalysisEmbedRendererContext';
import {useAnalysisDocumentEditorContext} from './AnalysisDocumentEditorContext';

type BlockControlState = {
  element: HTMLElement;
  pos: number;
  top: number;
};

type DraggableNode = NonNullable<ReturnType<Editor['state']['doc']['nodeAt']>>;

type AnalysisBlockControlsProps = {
  scrollElement: HTMLElement | null;
};

type BlockMenuItem = {
  label: string;
  description: string;
  icon: FC<{className?: string}>;
  createNode: (id: string) => Record<string, unknown>;
};

function labelFromArtifactType(artifactType: string) {
  return artifactType
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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

function buildEmbedMenuItems(
  artifactTypes: AnalysisArtifactEmbedType[],
): BlockMenuItem[] {
  return artifactTypes.map((artifactType) => {
    const label =
      artifactType.label ?? labelFromArtifactType(artifactType.artifactType);
    return {
      label,
      description: artifactType.description ?? `Embed ${label}`,
      icon: Rows3Icon,
      createNode:
        artifactType.createNode ??
        ((id: string) => ({
          type: 'analysisArtifactEmbed',
          attrs: {
            id,
            artifactId: '',
            artifactType: artifactType.artifactType,
            caption: '',
          },
        })),
    };
  });
}

function buildBlockMenuItems(
  artifactTypes: AnalysisArtifactEmbedType[],
): BlockMenuItem[] {
  return [
    {
      label: 'Text',
      description: 'Plain paragraph',
      icon: PilcrowIcon,
      createNode: (id) => ({
        type: 'paragraph',
        attrs: {id},
      }),
    },
    {
      label: 'Heading',
      description: 'Section heading',
      icon: Heading1Icon,
      createNode: (id) => ({
        type: 'heading',
        attrs: {id, level: 1},
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
        type: 'analysisImage',
        attrs: {id, assetId: '', caption: ''},
      }),
    },
    {
      label: 'Chart',
      description: 'Standalone chart block',
      icon: BarChart3Icon,
      createNode: (id) => ({
        type: 'analysisChart',
        attrs: {id, tableName: '', config: {}, caption: ''},
      }),
    },
    ...buildEmbedMenuItems(artifactTypes),
  ];
}

export const AnalysisBlockControls: FC<AnalysisBlockControlsProps> = ({
  scrollElement,
}) => {
  const {editor, readOnly, generateBlockId} =
    useAnalysisDocumentEditorContext();
  const artifactTypes = useAnalysisArtifactEmbedTypes();
  const [activeBlock, setActiveBlock] = useState<BlockControlState | null>(
    null,
  );
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  const [handleMenuOpen, setHandleMenuOpen] = useState(false);
  const [handleTooltipOpen, setHandleTooltipOpen] = useState(false);
  const dragSourceRef = useRef<{pos: number; node: DraggableNode} | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const handleButtonRef = useRef<HTMLButtonElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const blockMenuItems = useMemo(
    () => buildBlockMenuItems(artifactTypes),
    [artifactTypes],
  );
  const menuOpen = insertMenuOpen || handleMenuOpen;

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
        top: elementRect.top - scrollRect.top + scrollElement.scrollTop,
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
        setHandleTooltipOpen(
          Boolean(
            !handleMenuOpen && handleButtonRef.current?.contains(event.target),
          ),
        );
        return;
      }
      setHandleTooltipOpen(false);
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
    const handleMouseLeave = () => {
      setHandleTooltipOpen(false);
      scheduleHide();
    };
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
    handleMenuOpen,
    menuOpen,
    readOnly,
    scheduleHide,
    scrollElement,
    updateActiveBlock,
  ]);

  const insertBlockAfterActive = useCallback(
    (createNode: BlockMenuItem['createNode']) => {
      if (!editor || !activeBlock) return;
      const node = getNodeAt(editor, activeBlock.pos);
      if (!node) return;
      editor
        .chain()
        .focus()
        .insertContentAt(
          activeBlock.pos + node.nodeSize,
          createNode(generateBlockId()),
        )
        .run();
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
    setHandleTooltipOpen(false);
    dragSourceRef.current = {pos: activeBlock.pos, node};
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-sqlrooms-analysis-block', 'move');
  };

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

  useEffect(() => {
    if (!editor || readOnly) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || (!event.metaKey && !event.ctrlKey)) return;
      if (!editor.isFocused) return;
      event.preventDefault();
      const selection = editor.state.selection;
      const pos =
        selection.$from.depth > 0 ? selection.$from.before(1) : selection.from;
      const element = editor.view.nodeDOM(pos);
      if (element instanceof HTMLElement) {
        updateActiveBlock(element);
      }
      setInsertMenuOpen(false);
      setHandleMenuOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor, readOnly, updateActiveBlock]);

  if (!editor || readOnly || !activeBlock) {
    return null;
  }

  return (
    <div
      ref={controlsRef}
      className="pointer-events-none absolute left-2 z-20 flex w-12 items-center justify-end gap-1"
      style={{top: activeBlock.top}}
    >
      <DropdownMenu open={insertMenuOpen} onOpenChange={setInsertMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="pointer-events-auto h-7 w-7 rounded-md opacity-70 hover:opacity-100"
            aria-label="Add block"
            title="Add block"
            onMouseDown={handlePlusMouseDown}
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" className="w-56">
          <DropdownMenuLabel>Insert block</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {blockMenuItems.map((item) => (
            <DropdownMenuItem
              key={item.label}
              className="items-start gap-2"
              onSelect={() => insertBlockAfterActive(item.createNode)}
            >
              <item.icon className="mt-0.5 h-4 w-4" />
              <span className="grid gap-0.5">
                <span>{item.label}</span>
                <span className="text-muted-foreground text-xs">
                  {item.description}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu
        open={handleMenuOpen}
        onOpenChange={(open) => {
          setHandleMenuOpen(open);
          if (open) setHandleTooltipOpen(false);
        }}
      >
        <div className="pointer-events-auto relative">
          <DropdownMenuTrigger asChild>
            <button
              ref={handleButtonRef}
              type="button"
              draggable
              className={cn(
                'flex h-7 w-7 cursor-grab items-center justify-center rounded-md opacity-70',
                'hover:bg-accent hover:text-accent-foreground hover:opacity-100 active:cursor-grabbing',
              )}
              aria-label="Block options"
              aria-describedby={
                handleTooltipOpen ? 'analysis-block-handle-tooltip' : undefined
              }
              onFocus={() => {
                if (!handleMenuOpen) setHandleTooltipOpen(true);
              }}
              onBlur={() => setHandleTooltipOpen(false)}
              onPointerMove={() => {
                if (!handleMenuOpen) setHandleTooltipOpen(true);
              }}
              onMouseMove={() => {
                if (!handleMenuOpen) setHandleTooltipOpen(true);
              }}
              onPointerLeave={() => setHandleTooltipOpen(false)}
              onMouseDown={handlePlusMouseDown}
              onDragStart={handleDragStart}
            >
              <GripVerticalIcon className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          {handleTooltipOpen ? (
            <div
              id="analysis-block-handle-tooltip"
              role="tooltip"
              className="bg-popover text-popover-foreground border-border pointer-events-none absolute top-9 left-0 z-50 w-max rounded-md border px-3 py-2 text-center text-sm shadow-md"
            >
              <div>
                <span className="font-medium">Drag</span>{' '}
                <span className="text-muted-foreground">to move</span>
              </div>
              <div>
                <span className="font-medium">Click or ⌘/</span>{' '}
                <span className="text-muted-foreground">to open menu</span>
              </div>
            </div>
          ) : null}
        </div>
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
    </div>
  );
};
