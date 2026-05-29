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
  type BlockDocumentStatefulBlockCreateNodeOptions,
  type BlockDocumentStatefulBlockType,
  useBlockDocumentStatefulBlockTypes,
} from '../BlockDocumentStatefulBlockRendererContext';
import {BLOCK_DOCUMENT_TITLE_NODE_NAME} from './extensions/BlockDocumentTitleNode';
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

type BlockDropTarget = {
  element: HTMLElement;
  pos: number;
  node: DraggableNode;
  insertAfter: boolean;
};

type BlockDropIndicator = {
  top: number;
  left: number;
  width: number;
};

type BlockMenuItem = {
  label: string;
  description: string;
  icon: FC<{className?: string}>;
  createNode: (
    id: string,
    options?: BlockDocumentStatefulBlockCreateNodeOptions,
  ) => Record<string, unknown>;
};

type InsertPlacement = 'before' | 'after';

const BLOCK_CONTROLS_STACK_HEIGHT = 80;
const BLOCK_CONTROLS_TOP_INSET = 4;
const BLOCK_CONTROLS_GUTTER_HOVER_WIDTH = 72;

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

function isTitleNode(node: ReturnType<typeof getNodeAt>) {
  return node?.type.name === BLOCK_DOCUMENT_TITLE_NODE_NAME;
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

function isPointerInEditorGutter(event: MouseEvent, editorElement: HTMLElement) {
  const editorRect = editorElement.getBoundingClientRect();
  return (
    event.clientX >= editorRect.left &&
    event.clientX <= editorRect.left + BLOCK_CONTROLS_GUTTER_HOVER_WIDTH &&
    event.clientY >= editorRect.top &&
    event.clientY <= editorRect.bottom
  );
}

function getBlockElementAtY(
  editor: Editor,
  editorElement: HTMLElement,
  clientY: number,
) {
  const blockRows = Array.from(editorElement.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement)
    .map((element) => {
      const pos = getBlockPos(editor, element);
      const node = pos == null ? null : getNodeAt(editor, pos);
      return pos != null && node && !isTitleNode(node)
        ? {element, rect: element.getBoundingClientRect()}
        : null;
    })
    .filter(
      (row): row is {element: HTMLElement; rect: DOMRect} => row != null,
    );

  for (let index = 0; index < blockRows.length; index += 1) {
    const row = blockRows[index]!;
    const previousRow = blockRows[index - 1];
    const nextRow = blockRows[index + 1];
    const topBoundary = previousRow
      ? (previousRow.rect.bottom + row.rect.top) / 2
      : row.rect.top;
    const bottomBoundary = nextRow
      ? (row.rect.bottom + nextRow.rect.top) / 2
      : row.rect.bottom;
    if (clientY >= topBoundary && clientY <= bottomBoundary) {
      return row.element;
    }
  }

  return null;
}

function getBlockDropTarget(
  editor: Editor,
  editorElement: HTMLElement,
  event: globalThis.DragEvent,
): BlockDropTarget | null {
  const toDropTarget = (
    element: HTMLElement,
    insertAfter?: boolean,
  ): BlockDropTarget | null => {
    const pos = getBlockPos(editor, element);
    const node = pos == null ? null : getNodeAt(editor, pos);
    if (pos == null || !node || isTitleNode(node)) return null;

    const rect = element.getBoundingClientRect();
    return {
      element,
      pos,
      node,
      insertAfter:
        insertAfter ?? event.clientY > rect.top + rect.height / 2,
    };
  };

  const directTargetElement = directEditorChild(editorElement, event.target);
  const directTarget = directTargetElement
    ? toDropTarget(directTargetElement)
    : null;
  if (directTarget) return directTarget;

  const blockTargets = Array.from(editorElement.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement)
    .map((element) => {
      const target = toDropTarget(element);
      return target ? {target, rect: element.getBoundingClientRect()} : null;
    })
    .filter(
      (target): target is {target: BlockDropTarget; rect: DOMRect} =>
        target != null,
    );

  for (const {target, rect} of blockTargets) {
    if (event.clientY < rect.top) return {...target, insertAfter: false};
    if (event.clientY <= rect.bottom) {
      return {
        ...target,
        insertAfter: event.clientY > rect.top + rect.height / 2,
      };
    }
  }

  const lastTarget = blockTargets.at(-1)?.target;
  return lastTarget ? {...lastTarget, insertAfter: true} : null;
}

function getMoveInsertPos(
  source: {pos: number; node: DraggableNode},
  target: BlockDropTarget,
) {
  let insertPos =
    target.pos + (target.insertAfter ? target.node.nodeSize : 0);
  if (insertPos > source.pos) {
    insertPos -= source.node.nodeSize;
  }
  return insertPos;
}

function isNoopMove(
  source: {pos: number; node: DraggableNode},
  insertPos: number,
) {
  return (
    insertPos === source.pos || insertPos === source.pos + source.node.nodeSize
  );
}

function getDropIndicator(
  target: BlockDropTarget,
  editorElement: HTMLElement,
  scrollElement: HTMLElement,
): BlockDropIndicator {
  const targetRect = target.element.getBoundingClientRect();
  const editorRect = editorElement.getBoundingClientRect();
  const scrollRect = scrollElement.getBoundingClientRect();
  const topInViewport = target.insertAfter ? targetRect.bottom : targetRect.top;

  return {
    top: topInViewport - scrollRect.top + scrollElement.scrollTop,
    left: editorRect.left - scrollRect.left + scrollElement.scrollLeft + 64,
    width: Math.max(0, editorRect.width - 88),
  };
}

function getBlockControlsTop(elementRect: DOMRect, scrollElement: HTMLElement) {
  const scrollRect = scrollElement.getBoundingClientRect();
  const blockTop =
    elementRect.top - scrollRect.top + scrollElement.scrollTop;
  const centeredOffset = elementRect.height / 2;
  const topAlignedOffset =
    BLOCK_CONTROLS_STACK_HEIGHT / 2 + BLOCK_CONTROLS_TOP_INSET;

  return blockTop + Math.min(centeredOffset, topAlignedOffset);
}

function getNodeId(node: DraggableNode, generateBlockId: () => string) {
  const id = node.attrs.id;
  return typeof id === 'string' ? id : generateBlockId();
}

function textContent(text: string) {
  return text ? [{type: 'text', text}] : undefined;
}

function paragraphContent(text: string) {
  return [{type: 'paragraph', content: textContent(text)}];
}

function preserveTextInNode(
  node: Record<string, unknown>,
  text: string,
): Record<string, unknown> {
  if (!text) return node;

  switch (node.type) {
    case 'paragraph':
    case 'heading':
    case 'codeBlock':
      return {...node, content: textContent(text)};
    case 'bulletList':
    case 'orderedList':
      return {
        ...node,
        content: [
          {
            type: 'listItem',
            content: paragraphContent(text),
          },
        ],
      };
    case 'taskList':
      return {
        ...node,
        content: [
          {
            type: 'taskItem',
            attrs: {checked: false},
            content: paragraphContent(text),
          },
        ],
      };
    case 'blockquote':
      return {...node, content: paragraphContent(text)};
    default:
      return node;
  }
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
  const [dropIndicator, setDropIndicator] =
    useState<BlockDropIndicator | null>(null);
  const dragSourceRef = useRef<{pos: number; node: DraggableNode} | null>(null);
  const suppressHandleClickRef = useRef(false);
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
      const node = pos == null ? null : getNodeAt(editor, pos);
      if (pos == null || !node || isTitleNode(node)) {
        if (!menuOpen) scheduleHide();
        return;
      }
      cancelHide();
      const elementRect = element.getBoundingClientRect();
      setActiveBlock({
        element,
        pos,
        top: getBlockControlsTop(elementRect, scrollElement),
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
      if (isPointerInEditorGutter(event, editorElement)) {
        updateActiveBlock(
          getBlockElementAtY(editor, editorElement, event.clientY),
        );
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

  const turnActiveBlockInto = useCallback(
    (createNode: BlockMenuItem['createNode']) => {
      if (!editor || !activeBlock) return;
      const node = getNodeAt(editor, activeBlock.pos);
      if (!node || isTitleNode(node)) return;

      const replacement = preserveTextInNode(
        createNode(getNodeId(node, generateBlockId), {
          initialText: node.textContent,
        }),
        node.textContent,
      );
      editor
        .chain()
        .focus()
        .insertContentAt(
          {
            from: activeBlock.pos,
            to: activeBlock.pos + node.nodeSize,
          },
          replacement,
        )
        .run();
      setHandleMenuOpen(false);
      setActiveBlock(null);
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
    if (!editor || !activeBlock || !event.dataTransfer) return;
    const node = getNodeAt(editor, activeBlock.pos);
    if (!node || isTitleNode(node)) return;
    dragSourceRef.current = {pos: activeBlock.pos, node};
    suppressHandleClickRef.current = true;
    setHandleMenuOpen(false);
    cancelHide();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(
      'application/x-sqlrooms-block-document-block',
      'move',
    );
  };

  const handleHandleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (suppressHandleClickRef.current) {
      event.preventDefault();
      return;
    }
    setHandleMenuOpen((open) => !open);
  };

  const renderMenuItem = (item: BlockMenuItem, onSelect: () => void) => (
    <DropdownMenuItem
      key={item.label}
      className="items-start gap-2"
      onSelect={onSelect}
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

  const renderBlockTypeMenuItems = (
    onSelect: (item: BlockMenuItem) => void,
  ) => (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="gap-2">
          <PilcrowIcon className="h-4 w-4" />
          Text
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-60">
          {textMenuItems.map((item) =>
            renderMenuItem(item, () => onSelect(item)),
          )}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      {mediaMenuItems.map((item) => renderMenuItem(item, () => onSelect(item)))}
    </>
  );

  const renderInsertMenuContent = (placement: InsertPlacement) => (
    <DropdownMenuContent align="center" side="right" className="w-60">
      <DropdownMenuLabel>
        Insert {placement === 'before' ? 'above' : 'below'}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      {renderBlockTypeMenuItems((item) =>
        insertBlockRelativeToActive(item.createNode, placement),
      )}
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
      const source = dragSourceRef.current;
      if (!source) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }

      const target = getBlockDropTarget(editor, editorElement, event);
      const insertPos = target ? getMoveInsertPos(source, target) : null;
      if (!target || insertPos == null || isNoopMove(source, insertPos)) {
        setDropIndicator(null);
        return;
      }
      const nextIndicator = getDropIndicator(
        target,
        editorElement,
        scrollElement,
      );
      setDropIndicator((current) =>
        current &&
        current.top === nextIndicator.top &&
        current.left === nextIndicator.left &&
        current.width === nextIndicator.width
          ? current
          : nextIndicator,
      );
    };

    const handleDrop = (event: globalThis.DragEvent) => {
      const source = dragSourceRef.current;
      if (!source) return;
      event.preventDefault();
      event.stopPropagation();

      const target = getBlockDropTarget(editor, editorElement, event);
      if (!target) {
        dragSourceRef.current = null;
        setDropIndicator(null);
        return;
      }

      const insertPos = getMoveInsertPos(source, target);

      if (!isNoopMove(source, insertPos)) {
        const tr = editor.state.tr
          .delete(source.pos, source.pos + source.node.nodeSize)
          .insert(insertPos, source.node);
        editor.view.dispatch(tr.scrollIntoView());
        editor.commands.focus();
      }
      dragSourceRef.current = null;
      setDropIndicator(null);
    };

    const handleDragEnd = () => {
      dragSourceRef.current = null;
      setDropIndicator(null);
      window.setTimeout(() => {
        suppressHandleClickRef.current = false;
      }, 200);
    };

    const handleDragLeave = (event: globalThis.DragEvent) => {
      if (!dragSourceRef.current) return;
      if (
        event.relatedTarget instanceof Node &&
        scrollElement.contains(event.relatedTarget)
      ) {
        return;
      }
      setDropIndicator(null);
    };

    scrollElement.addEventListener('dragover', handleDragOver, true);
    scrollElement.addEventListener('dragleave', handleDragLeave, true);
    scrollElement.addEventListener('drop', handleDrop, true);
    window.addEventListener('dragend', handleDragEnd);

    return () => {
      scrollElement.removeEventListener('dragover', handleDragOver, true);
      scrollElement.removeEventListener('dragleave', handleDragLeave, true);
      scrollElement.removeEventListener('drop', handleDrop, true);
      window.removeEventListener('dragend', handleDragEnd);
    };
  }, [editor, readOnly, scrollElement]);

  if (!editor || readOnly) {
    return null;
  }

  return (
    <>
      {dropIndicator ? (
        <div
          className="bg-primary pointer-events-none absolute z-30 h-0.5 rounded-full"
          style={{
            top: dropIndicator.top,
            left: dropIndicator.left,
            width: dropIndicator.width,
          }}
        />
      ) : null}
      {activeBlock ? (
        <div
          ref={controlsRef}
          className="pointer-events-none absolute left-3 z-20 flex w-7 -translate-y-1/2 flex-col items-center gap-0.5"
          style={{top: activeBlock.top}}
        >
          <TooltipProvider>
            {renderAddButton('before')}
            <DropdownMenu
              open={handleMenuOpen}
              onOpenChange={setHandleMenuOpen}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="pointer-events-auto relative flex h-7 w-7 shrink-0">
                    <DropdownMenuTrigger asChild>
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0"
                      />
                    </DropdownMenuTrigger>
                    <button
                      type="button"
                      draggable
                      className={cn(
                        'flex h-7 w-7 cursor-grab items-center justify-center rounded-md opacity-70',
                        'hover:bg-accent hover:text-accent-foreground hover:opacity-100 active:cursor-grabbing',
                      )}
                      aria-label="Block options"
                      onClick={handleHandleClick}
                      onDragStart={handleDragStart}
                    >
                      <GripVerticalIcon className="h-4 w-4" />
                    </button>
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  align="center"
                  side="right"
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
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2">
                    <Rows3Icon className="h-4 w-4" />
                    Turn into
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-60">
                    <DropdownMenuLabel>Turn into</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {renderBlockTypeMenuItems((item) =>
                      turnActiveBlockInto(item.createNode),
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
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
      ) : null}
    </>
  );
};
