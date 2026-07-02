import {cn, ScrollArea} from '@sqlrooms/ui';
import {TextSelection} from '@tiptap/pm/state';
import {EditorContent, type Editor} from '@tiptap/react';
import type {FC, MouseEvent as ReactMouseEvent} from 'react';
import {useCallback, useState} from 'react';
import {BlockDocumentBlockControls} from './BlockDocumentBlockControls';
import {useBlockDocumentEditorContext} from './BlockDocumentEditorContext';
import {useBlockSettingsStore} from '../block-settings/useBlockSettingsStore';

export type BlockDocumentEditorContentProps = {
  className?: string;
};

type ClosestTextBlock = {
  element: HTMLElement;
  pos: number;
  nodeSize: number;
};

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

function getDirectNodePos(editor: Editor, element: HTMLElement) {
  try {
    const pos = editor.view.posAtDOM(element, 0);
    const resolvedPos = editor.state.doc.resolve(pos);
    return resolvedPos.depth > 0 ? resolvedPos.before(1) : pos;
  } catch {
    return null;
  }
}

function getTextBlockFromElement(
  editor: Editor,
  element: HTMLElement,
): ClosestTextBlock | null {
  const pos = getDirectNodePos(editor, element);
  const node = pos == null ? null : editor.state.doc.nodeAt(pos);
  if (pos == null || !node?.isTextblock) return null;
  return {element, pos, nodeSize: node.nodeSize};
}

function getClosestTextBlockAtY(
  editor: Editor,
  editorElement: HTMLElement,
  clientY: number,
): ClosestTextBlock | null {
  const blockRows = Array.from(editorElement.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement)
    .map((element) => {
      const pos = getDirectNodePos(editor, element);
      const node = pos == null ? null : editor.state.doc.nodeAt(pos);
      return pos != null && node
        ? {element, node, pos, rect: element.getBoundingClientRect()}
        : null;
    })
    .filter(
      (
        row,
      ): row is {
        element: HTMLElement;
        node: NonNullable<ReturnType<Editor['state']['doc']['nodeAt']>>;
        pos: number;
        rect: DOMRect;
      } => row != null,
    );

  for (let index = 0; index < blockRows.length; index += 1) {
    const row = blockRows[index]!;
    const previousRow = blockRows[index - 1];
    const nextRow = blockRows[index + 1];
    const topBoundary = previousRow
      ? (previousRow.rect.bottom + row.rect.top) / 2
      : Number.NEGATIVE_INFINITY;
    const bottomBoundary = nextRow
      ? (row.rect.bottom + nextRow.rect.top) / 2
      : Number.POSITIVE_INFINITY;

    if (clientY >= topBoundary && clientY <= bottomBoundary) {
      return row.node.isTextblock
        ? {element: row.element, pos: row.pos, nodeSize: row.node.nodeSize}
        : null;
    }
  }

  return null;
}

function getTextBlockForClick(
  editor: Editor,
  event: ReactMouseEvent,
): ClosestTextBlock | null {
  const editorElement = editor.view.dom as HTMLElement;
  const clickedBlock = directEditorChild(editorElement, event.target);
  return (
    (clickedBlock ? getTextBlockFromElement(editor, clickedBlock) : null) ??
    getClosestTextBlockAtY(editor, editorElement, event.clientY)
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function getTextSelectionPos(
  editor: Editor,
  block: ClosestTextBlock,
  event: ReactMouseEvent,
) {
  const contentStart = block.pos + 1;
  const contentEnd = block.pos + block.nodeSize - 1;
  const rect = block.element.getBoundingClientRect();
  const y =
    rect.height > 2
      ? clamp(event.clientY, rect.top + 1, rect.bottom - 1)
      : event.clientY;
  const coordsPos = editor.view.posAtCoords({
    left: event.clientX,
    top: y,
  })?.pos;

  if (
    coordsPos != null &&
    coordsPos >= contentStart &&
    coordsPos <= contentEnd
  ) {
    return coordsPos;
  }

  return event.clientY >= rect.top + rect.height / 2
    ? contentEnd
    : contentStart;
}

function focusClosestTextBlock(editor: Editor, event: ReactMouseEvent) {
  const block = getTextBlockForClick(editor, event);
  if (!block) return;

  const selectionPos = getTextSelectionPos(editor, block, event);
  const selection = TextSelection.near(editor.state.doc.resolve(selectionPos));
  editor.view.dispatch(editor.state.tr.setSelection(selection));
  editor.view.focus();
}

function isInteractiveClickTarget(target: HTMLElement) {
  return Boolean(
    target.closest(
      [
        'a[href]',
        'button',
        'input',
        'select',
        'textarea',
        '[contenteditable="false"]',
        '[role="button"]',
        '[role="menu"]',
        '[role="menuitem"]',
      ].join(','),
    ),
  );
}

export const BlockDocumentEditorContent: FC<
  BlockDocumentEditorContentProps
> = ({className}) => {
  const {editor, readOnly} = useBlockDocumentEditorContext();
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );
  const clearSelection = useBlockSettingsStore(
    (state) => state.blockSettings?.clearSelection,
  );

  const handleClick = useCallback(
    (e: ReactMouseEvent) => {
      // Clear custom block selection if clicking in editable document space.
      const target = e.target as HTMLElement;
      if (
        editor &&
        scrollElement?.contains(target) &&
        !isInteractiveClickTarget(target)
      ) {
        clearSelection?.();
        if (!readOnly) {
          focusClosestTextBlock(editor, e);
        }
      }
    },
    [clearSelection, editor, readOnly, scrollElement],
  );

  return (
    <ScrollArea
      viewportRef={setScrollElement}
      className={cn(
        'relative h-full min-h-0 flex-1 overflow-hidden [&_[data-radix-scroll-area-viewport]>div]:!block [&_[data-radix-scroll-area-viewport]>div]:!min-h-full',
        className,
      )}
      onClick={handleClick}
    >
      <div className="relative min-h-full">
        <EditorContent editor={editor} className="min-h-full" />
        <BlockDocumentBlockControls scrollElement={scrollElement} />
      </div>
    </ScrollArea>
  );
};
