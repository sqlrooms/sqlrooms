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
  ScrollArea,
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

type FocusedBlockState = BlockControlState & {
  left: number;
  menuTop: number;
  placeholderStyle: BlockTypeSearchPlaceholderStyle;
};

type BlockTypeSearchPlaceholderStyle = {
  fontFamily: string;
  fontSize: string;
  fontStyle: string;
  fontWeight: string;
  letterSpacing: string;
  lineHeight: string;
};

type BlockTypeSearchState = FocusedBlockState & {
  mode: 'slash' | 'filter';
  placeholderLeft: number;
  placeholderStyle: BlockTypeSearchPlaceholderStyle;
  placeholderTop: number;
  query: string;
};

type BlockTypeSearchSelection = {
  index: number;
  key: string;
};

const BLOCK_CONTROLS_STACK_HEIGHT = 32;
const BLOCK_CONTROLS_TOP_INSET = 4;
const BLOCK_CONTROLS_GUTTER_HOVER_WIDTH = 96;
const DRAG_SCROLL_EDGE_THRESHOLD = 80;
const DRAG_SCROLL_MAX_STEP = 28;
const BLOCK_TYPE_SEARCH_MENU_MAX_HEIGHT = 300;
const BLOCK_TYPE_SEARCH_MENU_LIST_MAX_HEIGHT = 240;
const BLOCK_TYPE_SEARCH_MENU_BOTTOM_MARGIN = 16;
const BLOCK_DOCUMENT_CONTENT_LEFT_GUTTER = 96;
const EMPTY_BLOCK_PLACEHOLDER = "Press '/' to change block type";
const SLASH_SEARCH_PLACEHOLDER = 'Type to search';
const FILTER_SEARCH_PLACEHOLDER = 'Type to filter';

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

function isEmptyTextBlock(node: ReturnType<typeof getNodeAt>) {
  return node?.type.name === 'paragraph' && node.textContent.length === 0;
}

function getFocusedParagraphBlock(editor: Editor): {
  element: HTMLElement;
  pos: number;
  node: DraggableNode;
} | null {
  if (!editor.isFocused) return null;
  const {$from} = editor.state.selection;
  if ($from.depth < 1) return null;

  const pos = $from.before(1);
  const node = getNodeAt(editor, pos);
  if (!node || isTitleNode(node) || node.type.name !== 'paragraph') {
    return null;
  }

  const dom = editor.view.nodeDOM(pos);
  if (!(dom instanceof HTMLElement)) return null;

  return {
    element: dom,
    pos,
    node,
  };
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

function isPointerInEditorGutter(
  event: MouseEvent,
  editorElement: HTMLElement,
) {
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
    .filter((row): row is {element: HTMLElement; rect: DOMRect} => row != null);

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
      insertAfter: insertAfter ?? event.clientY > rect.top + rect.height / 2,
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
  let insertPos = target.pos + (target.insertAfter ? target.node.nodeSize : 0);
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
    left:
      editorRect.left -
      scrollRect.left +
      scrollElement.scrollLeft +
      BLOCK_DOCUMENT_CONTENT_LEFT_GUTTER,
    width: Math.max(
      0,
      editorRect.width - BLOCK_DOCUMENT_CONTENT_LEFT_GUTTER - 24,
    ),
  };
}

function autoScrollOnDragOver(
  scrollElement: HTMLElement,
  event: globalThis.DragEvent,
) {
  const scrollRect = scrollElement.getBoundingClientRect();
  const distanceFromTop = event.clientY - scrollRect.top;
  const distanceFromBottom = scrollRect.bottom - event.clientY;

  if (
    distanceFromTop >= DRAG_SCROLL_EDGE_THRESHOLD &&
    distanceFromBottom >= DRAG_SCROLL_EDGE_THRESHOLD
  ) {
    return;
  }

  const topPressure =
    distanceFromTop < DRAG_SCROLL_EDGE_THRESHOLD
      ? (DRAG_SCROLL_EDGE_THRESHOLD - distanceFromTop) /
        DRAG_SCROLL_EDGE_THRESHOLD
      : 0;
  const bottomPressure =
    distanceFromBottom < DRAG_SCROLL_EDGE_THRESHOLD
      ? (DRAG_SCROLL_EDGE_THRESHOLD - distanceFromBottom) /
        DRAG_SCROLL_EDGE_THRESHOLD
      : 0;
  const delta =
    Math.round((bottomPressure - topPressure) * DRAG_SCROLL_MAX_STEP) || 0;

  if (delta !== 0) {
    scrollElement.scrollTop += delta;
  }
}

function getBlockControlsTop(elementRect: DOMRect, scrollElement: HTMLElement) {
  const scrollRect = scrollElement.getBoundingClientRect();
  const blockTop = elementRect.top - scrollRect.top + scrollElement.scrollTop;
  const centeredOffset = elementRect.height / 2;
  const topAlignedOffset =
    BLOCK_CONTROLS_STACK_HEIGHT / 2 + BLOCK_CONTROLS_TOP_INSET;

  return blockTop + Math.min(centeredOffset, topAlignedOffset);
}

function getFocusedBlockState(
  block: {element: HTMLElement; pos: number},
  scrollElement: HTMLElement,
): FocusedBlockState {
  const elementRect = block.element.getBoundingClientRect();
  const scrollRect = scrollElement.getBoundingClientRect();

  return {
    element: block.element,
    pos: block.pos,
    top: elementRect.top - scrollRect.top + scrollElement.scrollTop,
    left: elementRect.left - scrollRect.left + scrollElement.scrollLeft,
    menuTop: elementRect.bottom - scrollRect.top + scrollElement.scrollTop + 4,
    placeholderStyle: getPlaceholderStyle(block.element),
  };
}

function getPlaceholderStyle(
  element: HTMLElement,
): BlockTypeSearchPlaceholderStyle {
  const style = window.getComputedStyle(element);
  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontStyle: style.fontStyle,
    fontWeight: style.fontWeight,
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
  };
}

function getSlashPlaceholderPosition(
  editor: Editor,
  block: {element: HTMLElement; pos: number},
  scrollElement: HTMLElement,
): Pick<
  BlockTypeSearchState,
  'placeholderLeft' | 'placeholderStyle' | 'placeholderTop'
> {
  const scrollRect = scrollElement.getBoundingClientRect();
  const elementRect = block.element.getBoundingClientRect();
  const placeholderTop =
    elementRect.top - scrollRect.top + scrollElement.scrollTop;
  const placeholderStyle = getPlaceholderStyle(block.element);
  try {
    const slashEndCoords = editor.view.coordsAtPos(block.pos + 2);
    return {
      placeholderLeft:
        slashEndCoords.left - scrollRect.left + scrollElement.scrollLeft,
      placeholderStyle,
      placeholderTop,
    };
  } catch {
    return {
      placeholderLeft:
        elementRect.left - scrollRect.left + scrollElement.scrollLeft + 10,
      placeholderStyle,
      placeholderTop,
    };
  }
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

function clearTextInNode(
  node: Record<string, unknown>,
): Record<string, unknown> {
  switch (node.type) {
    case 'paragraph':
    case 'heading':
    case 'codeBlock':
      return {...node, content: undefined};
    case 'bulletList':
    case 'orderedList':
      return {
        ...node,
        content: [
          {
            type: 'listItem',
            content: [{type: 'paragraph'}],
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
            content: [{type: 'paragraph'}],
          },
        ],
      };
    case 'blockquote':
      return {...node, content: [{type: 'paragraph'}]};
    default:
      return node;
  }
}

function blockMenuItemMatchesQuery(item: BlockMenuItem, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return `${item.label} ${item.description}`
    .toLowerCase()
    .includes(normalizedQuery);
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
            ...(blockType.resizableHeight
              ? {height: blockType.defaultHeight ?? 560}
              : {}),
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
  const [handleMenuOpen, setHandleMenuOpen] = useState(false);
  const [focusedEmptyBlock, setFocusedEmptyBlock] =
    useState<FocusedBlockState | null>(null);
  const [blockTypeSearch, setBlockTypeSearch] =
    useState<BlockTypeSearchState | null>(null);
  const [blockTypeSearchMenuOpen, setBlockTypeSearchMenuOpen] = useState(false);
  const [blockTypeSearchSelection, setBlockTypeSearchSelection] =
    useState<BlockTypeSearchSelection>({index: 0, key: ''});
  const [dropIndicator, setDropIndicator] = useState<BlockDropIndicator | null>(
    null,
  );
  const dragSourceRef = useRef<{pos: number; node: DraggableNode} | null>(null);
  const filterBlockIdRef = useRef<string | null>(null);
  const suppressHandleClickRef = useRef(false);
  const controlsRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const textMenuItems = useMemo(() => buildTextBlockMenuItems(), []);
  const mediaMenuItems = useMemo(
    () => buildMediaBlockMenuItems(statefulBlockTypes),
    [statefulBlockTypes],
  );
  const filteredTextMenuItems = useMemo(
    () =>
      textMenuItems.filter((item) =>
        blockMenuItemMatchesQuery(item, blockTypeSearch?.query ?? ''),
      ),
    [blockTypeSearch?.query, textMenuItems],
  );
  const filteredMediaMenuItems = useMemo(
    () =>
      mediaMenuItems.filter((item) =>
        blockMenuItemMatchesQuery(item, blockTypeSearch?.query ?? ''),
      ),
    [blockTypeSearch?.query, mediaMenuItems],
  );
  const blockTypeSearchMenuItems = useMemo(
    () => [...filteredTextMenuItems, ...filteredMediaMenuItems],
    [filteredMediaMenuItems, filteredTextMenuItems],
  );
  const blockTypeSearchListHeight = useMemo(() => {
    const emptyStateHeight = 36;
    const estimatedItemHeight = 36;
    return Math.min(
      BLOCK_TYPE_SEARCH_MENU_LIST_MAX_HEIGHT,
      blockTypeSearchMenuItems.length
        ? blockTypeSearchMenuItems.length * estimatedItemHeight
        : emptyStateHeight,
    );
  }, [blockTypeSearchMenuItems.length]);
  const blockTypeSearchSelectionKey = `${blockTypeSearch?.mode ?? ''}:${
    blockTypeSearch?.query ?? ''
  }:${blockTypeSearchMenuItems.length}`;
  const blockTypeSearchSelectedIndex =
    blockTypeSearchSelection.key === blockTypeSearchSelectionKey
      ? Math.min(
          blockTypeSearchSelection.index,
          Math.max(0, blockTypeSearchMenuItems.length - 1),
        )
      : 0;
  const menuOpen = handleMenuOpen || blockTypeSearchMenuOpen;
  const addAboveModifierLabel = useMemo(() => {
    if (typeof navigator === 'undefined') return 'Alt';
    return /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? 'Option' : 'Alt';
  }, []);

  useEffect(() => {
    if (!blockTypeSearch && !blockTypeSearchMenuOpen) {
      filterBlockIdRef.current = null;
    }
  }, [blockTypeSearch, blockTypeSearchMenuOpen]);

  useEffect(() => {
    if (!blockTypeSearchMenuOpen) return;
    const selectedItem = document.querySelector<HTMLElement>(
      `[data-block-type-search-item="${blockTypeSearchSelectedIndex}"]`,
    );
    selectedItem?.scrollIntoView({block: 'nearest'});
  }, [
    blockTypeSearchMenuItems.length,
    blockTypeSearchMenuOpen,
    blockTypeSearchSelectedIndex,
  ]);

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

  const updateFocusedTextBlock = useCallback(
    (openSlashMenu: boolean) => {
      if (!editor || !scrollElement || readOnly) {
        setFocusedEmptyBlock(null);
        setBlockTypeSearch(null);
        setBlockTypeSearchMenuOpen(false);
        filterBlockIdRef.current = null;
        return;
      }

      const focusedBlock = getFocusedParagraphBlock(editor);
      if (!focusedBlock) {
        setFocusedEmptyBlock(null);
        setBlockTypeSearch(null);
        setBlockTypeSearchMenuOpen(false);
        filterBlockIdRef.current = null;
        return;
      }

      const blockState = getFocusedBlockState(focusedBlock, scrollElement);
      const text = focusedBlock.node.textContent;
      const focusedBlockId = focusedBlock.node.attrs.id;
      const filterBlockId = filterBlockIdRef.current;

      if (text.startsWith('/')) {
        setFocusedEmptyBlock(null);
        setBlockTypeSearch({
          ...blockState,
          mode: 'slash',
          ...getSlashPlaceholderPosition(editor, focusedBlock, scrollElement),
          query: text.slice(1),
        });
        if (openSlashMenu) {
          setBlockTypeSearchMenuOpen(true);
        }
        return;
      }

      if (filterBlockId && focusedBlockId === filterBlockId) {
        setFocusedEmptyBlock(null);
        setBlockTypeSearch({
          ...blockState,
          mode: 'filter',
          placeholderLeft: blockState.left,
          placeholderStyle: blockState.placeholderStyle,
          placeholderTop: blockState.top,
          query: text,
        });
        if (openSlashMenu) {
          setBlockTypeSearchMenuOpen(true);
        }
        return;
      }

      setBlockTypeSearch(null);
      setBlockTypeSearchMenuOpen(false);
      if (filterBlockId) {
        filterBlockIdRef.current = null;
      }
      setFocusedEmptyBlock(
        isEmptyTextBlock(focusedBlock.node) ? blockState : null,
      );
    },
    [editor, readOnly, scrollElement],
  );

  useEffect(() => {
    if (!editor || !scrollElement || readOnly) return;

    const handleFocusOrSelectionUpdate = () => updateFocusedTextBlock(true);
    const handleUpdate = () => updateFocusedTextBlock(true);
    const handleScrollOrResize = () => updateFocusedTextBlock(false);
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(handleScrollOrResize);

    editor.on('focus', handleFocusOrSelectionUpdate);
    editor.on('selectionUpdate', handleFocusOrSelectionUpdate);
    editor.on('update', handleUpdate);
    resizeObserver?.observe(editor.view.dom);
    scrollElement.addEventListener('scroll', handleScrollOrResize, {
      passive: true,
    });
    window.addEventListener('resize', handleScrollOrResize);

    handleFocusOrSelectionUpdate();

    return () => {
      editor.off('focus', handleFocusOrSelectionUpdate);
      editor.off('selectionUpdate', handleFocusOrSelectionUpdate);
      editor.off('update', handleUpdate);
      resizeObserver?.disconnect();
      scrollElement.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [editor, readOnly, scrollElement, updateFocusedTextBlock]);

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

  const turnBlockInto = useCallback(
    (
      block: BlockControlState | null,
      createNode: BlockMenuItem['createNode'],
    ) => {
      if (!editor || !block) return;
      const node = getNodeAt(editor, block.pos);
      if (!node || isTitleNode(node)) return;

      const replacement = preserveTextInNode(
        createNode(getNodeId(node, generateBlockId), {
          initialText: node.textContent,
        }),
        node.textContent,
      );

      if (
        replacement.type === 'paragraph' &&
        node.type.name === 'paragraph' &&
        isEmptyTextBlock(node)
      ) {
        setHandleMenuOpen(false);
        setBlockTypeSearchMenuOpen(false);
        setActiveBlock(null);
        setBlockTypeSearch(null);
        return;
      }

      editor
        .chain()
        .focus()
        .insertContentAt(
          {
            from: block.pos,
            to: block.pos + node.nodeSize,
          },
          replacement,
        )
        .run();

      setHandleMenuOpen(false);
      setBlockTypeSearchMenuOpen(false);
      setActiveBlock(null);
      setBlockTypeSearch(null);
    },
    [editor, generateBlockId],
  );

  const turnActiveBlockInto = useCallback(
    (createNode: BlockMenuItem['createNode']) => {
      turnBlockInto(activeBlock, createNode);
    },
    [activeBlock, turnBlockInto],
  );

  const turnBlockTypeSearchInto = useCallback(
    (createNode: BlockMenuItem['createNode']) => {
      if (!editor || !blockTypeSearch) return;
      const node = getNodeAt(editor, blockTypeSearch.pos);
      if (!node || isTitleNode(node)) return;

      const replacement = clearTextInNode(
        createNode(getNodeId(node, generateBlockId), {initialText: ''}),
      );

      if (
        replacement.type === 'paragraph' &&
        node.type.name === 'paragraph' &&
        isEmptyTextBlock(node)
      ) {
        setBlockTypeSearchMenuOpen(false);
        setBlockTypeSearch(null);
        setFocusedEmptyBlock(null);
        return;
      }

      editor
        .chain()
        .focus()
        .insertContentAt(
          {
            from: blockTypeSearch.pos,
            to: blockTypeSearch.pos + node.nodeSize,
          },
          replacement,
        )
        .run();

      setBlockTypeSearchMenuOpen(false);
      setBlockTypeSearch(null);
      setFocusedEmptyBlock(null);
    },
    [blockTypeSearch, editor, generateBlockId],
  );

  const handleActiveBlockTypeSelect = useCallback(
    (item: BlockMenuItem) => {
      turnActiveBlockInto(item.createNode);
    },
    [turnActiveBlockInto],
  );

  const handleBlockTypeSearchSelect = useCallback(
    (item: BlockMenuItem) => {
      turnBlockTypeSearchInto(item.createNode);
    },
    [turnBlockTypeSearchInto],
  );

  useEffect(() => {
    if (
      !editor ||
      !blockTypeSearch ||
      !blockTypeSearchMenuOpen ||
      handleMenuOpen
    ) {
      return;
    }

    const editorElement = editor.view.dom as HTMLElement;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!blockTypeSearchMenuItems.length) return;
        event.preventDefault();
        event.stopPropagation();
        setBlockTypeSearchSelection((currentSelection) => {
          const currentIndex =
            currentSelection.key === blockTypeSearchSelectionKey
              ? currentSelection.index
              : 0;
          const direction = event.key === 'ArrowDown' ? 1 : -1;
          return {
            index:
              (currentIndex + direction + blockTypeSearchMenuItems.length) %
              blockTypeSearchMenuItems.length,
            key: blockTypeSearchSelectionKey,
          };
        });
        return;
      }

      if (event.key === 'Enter') {
        const selectedItem =
          blockTypeSearchMenuItems[blockTypeSearchSelectedIndex];
        if (!selectedItem) return;
        event.preventDefault();
        event.stopPropagation();
        handleBlockTypeSearchSelect(selectedItem);
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setBlockTypeSearchMenuOpen(false);
      }
    };

    editorElement.addEventListener('keydown', handleKeyDown, true);
    return () => {
      editorElement.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [
    blockTypeSearch,
    blockTypeSearchMenuItems,
    blockTypeSearchMenuOpen,
    blockTypeSearchSelectionKey,
    blockTypeSearchSelectedIndex,
    editor,
    handleBlockTypeSearchSelect,
    handleMenuOpen,
  ]);

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

  const handleAddBlockClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!editor || !activeBlock) return;
    const node = getNodeAt(editor, activeBlock.pos);
    if (!node || isTitleNode(node)) return;

    const blockId = generateBlockId();
    const insertPos = event.altKey
      ? activeBlock.pos
      : activeBlock.pos + node.nodeSize;
    filterBlockIdRef.current = blockId;
    editor
      .chain()
      .focus()
      .insertContentAt(insertPos, {
        type: 'paragraph',
        attrs: {id: blockId},
      })
      .setTextSelection(insertPos + 1)
      .run();

    setBlockTypeSearchMenuOpen(true);
    setHandleMenuOpen(false);
    setActiveBlock(null);
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
    setBlockTypeSearchMenuOpen(false);
    setHandleMenuOpen((open) => !open);
  };

  const renderMenuItem = (
    item: BlockMenuItem,
    onSelect: () => void,
    options?: {
      onPointerMove?: () => void;
      searchIndex?: number;
      selected?: boolean;
    },
  ) => (
    <Tooltip key={item.label}>
      <TooltipTrigger asChild>
        <DropdownMenuItem
          className={cn(
            'h-9 gap-2 px-2 py-1.5',
            options?.selected && 'bg-accent text-accent-foreground',
          )}
          data-block-type-search-item={options?.searchIndex}
          onPointerMove={options?.onPointerMove}
          onSelect={onSelect}
        >
          <item.icon className="h-4 w-4" />
          <span className="truncate">{item.label}</span>
        </DropdownMenuItem>
      </TooltipTrigger>
      <TooltipContent
        align="center"
        side="right"
        sideOffset={8}
        className="bg-popover text-popover-foreground border-border max-w-56 border px-2.5 py-1.5 text-xs shadow-md"
      >
        {item.description}
      </TooltipContent>
    </Tooltip>
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

  const renderBlockTypeSearchMenuGroup = (
    label: string,
    items: BlockMenuItem[],
    startIndex: number,
  ) =>
    items.length ? (
      <>
        <DropdownMenuLabel className="text-muted-foreground px-2 py-1 text-xs font-medium">
          {label}
        </DropdownMenuLabel>
        {items.map((item, itemIndex) => {
          const index = startIndex + itemIndex;
          return renderMenuItem(item, () => handleBlockTypeSearchSelect(item), {
            onPointerMove: () =>
              setBlockTypeSearchSelection({
                index,
                key: blockTypeSearchSelectionKey,
              }),
            searchIndex: index,
            selected: index === blockTypeSearchSelectedIndex,
          });
        })}
      </>
    ) : null;

  const renderSlashMenuItems = () =>
    blockTypeSearchMenuItems.length ? (
      <>
        {renderBlockTypeSearchMenuGroup(
          'Basic blocks',
          filteredTextMenuItems,
          0,
        )}
        {filteredTextMenuItems.length && filteredMediaMenuItems.length ? (
          <DropdownMenuSeparator className="my-1.5" />
        ) : null}
        {renderBlockTypeSearchMenuGroup(
          'Embeds',
          filteredMediaMenuItems,
          filteredTextMenuItems.length,
        )}
      </>
    ) : (
      <DropdownMenuItem disabled>No matching block types</DropdownMenuItem>
    );

  const renderAddButton = () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="pointer-events-auto h-7 w-7 shrink-0 rounded-md opacity-70 hover:opacity-100"
          aria-label="Add block"
          onClick={handleAddBlockClick}
          onMouseDown={handlePlusMouseDown}
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent
        align="center"
        side="bottom"
        className="bg-popover text-popover-foreground border-border border px-2.5 py-1.5 text-center text-xs shadow-md"
      >
        <div>
          <span className="font-medium">Click</span>{' '}
          <span className="text-muted-foreground">to add below</span>
        </div>
        <div>
          <span className="font-medium">{addAboveModifierLabel}+Click</span>{' '}
          <span className="text-muted-foreground">to add above</span>
        </div>
      </TooltipContent>
    </Tooltip>
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
      autoScrollOnDragOver(scrollElement, event);

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
      {focusedEmptyBlock ? (
        <div
          className="text-muted-foreground pointer-events-none absolute z-10"
          style={{
            ...focusedEmptyBlock.placeholderStyle,
            left: focusedEmptyBlock.left,
            top: focusedEmptyBlock.top,
          }}
        >
          {EMPTY_BLOCK_PLACEHOLDER}
        </div>
      ) : null}
      {blockTypeSearch ? (
        <>
          {!blockTypeSearch.query ? (
            <div
              className="text-muted-foreground pointer-events-none absolute z-10"
              style={{
                ...blockTypeSearch.placeholderStyle,
                left: blockTypeSearch.placeholderLeft,
                top: blockTypeSearch.placeholderTop,
              }}
            >
              {blockTypeSearch.mode === 'slash'
                ? SLASH_SEARCH_PLACEHOLDER
                : FILTER_SEARCH_PLACEHOLDER}
            </div>
          ) : null}
          <div
            className="pointer-events-none absolute z-30 h-px w-px"
            style={{top: blockTypeSearch.menuTop, left: blockTypeSearch.left}}
          >
            <DropdownMenu
              modal={false}
              open={blockTypeSearchMenuOpen && !handleMenuOpen}
              onOpenChange={setBlockTypeSearchMenuOpen}
            >
              <DropdownMenuTrigger asChild>
                <span className="pointer-events-none block h-px w-px" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="bottom"
                sideOffset={4}
                avoidCollisions={false}
                collisionPadding={{
                  bottom: BLOCK_TYPE_SEARCH_MENU_BOTTOM_MARGIN,
                  left: 8,
                  right: 8,
                  top: 8,
                }}
                className="flex w-72 flex-col overflow-hidden"
                style={{
                  maxHeight: `min(${BLOCK_TYPE_SEARCH_MENU_MAX_HEIGHT}px, calc(var(--radix-dropdown-menu-content-available-height) - ${BLOCK_TYPE_SEARCH_MENU_BOTTOM_MARGIN}px))`,
                }}
                onCloseAutoFocus={(event) => event.preventDefault()}
              >
                <DropdownMenuLabel className="text-muted-foreground px-2 py-1 text-xs font-normal">
                  Block
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <TooltipProvider delayDuration={300}>
                  <ScrollArea
                    className="min-h-0"
                    style={{
                      height: `min(${blockTypeSearchListHeight}px, max(72px, calc(var(--radix-dropdown-menu-content-available-height) - 72px)))`,
                    }}
                  >
                    {renderSlashMenuItems()}
                  </ScrollArea>
                </TooltipProvider>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      ) : null}
      {activeBlock ? (
        <div
          ref={controlsRef}
          className="pointer-events-none absolute left-2 z-20 flex -translate-y-1/2 flex-row items-center gap-0.5"
          style={{top: activeBlock.top}}
        >
          <TooltipProvider>
            {renderAddButton()}
            <DropdownMenu
              modal={false}
              open={handleMenuOpen}
              onOpenChange={(open) => {
                setHandleMenuOpen(open);
                if (open) setBlockTypeSearchMenuOpen(false);
              }}
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
              <DropdownMenuContent
                align="start"
                side="right"
                className="w-44"
                onCloseAutoFocus={(event) => event.preventDefault()}
              >
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2">
                    <Rows3Icon className="h-4 w-4" />
                    Turn into
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-60">
                    <DropdownMenuLabel>Turn into</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {renderBlockTypeMenuItems(handleActiveBlockTypeSelect)}
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
          </TooltipProvider>
        </div>
      ) : null}
    </>
  );
};
