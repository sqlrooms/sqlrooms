import {cn} from '@sqlrooms/ui';
import {NodeViewWrapper} from '@tiptap/react';
import {
  createElement,
  type FC,
  type MouseEvent as ReactMouseEvent,
  useState,
} from 'react';
import {
  useBlockDocumentStatefulBlockRenderer,
  useBlockDocumentStatefulBlockTypes,
} from '../../BlockDocumentStatefulBlockRendererContext';
import {useBlockDocumentEditorContext} from '../BlockDocumentEditorContext';
import {optionalNumber, optionalString, unknownRecord} from './nodeViewUtils';

type BlockDocumentStatefulBlockNodeViewProps = {
  node: {attrs: Record<string, unknown>};
  selected: boolean;
  updateAttributes: (attrs: Record<string, unknown>) => void;
};

function clampHeight(value: number, min: number, max?: number) {
  const minBounded = Math.max(min, value);
  return max == null ? minBounded : Math.min(max, minBounded);
}

export const BlockDocumentStatefulBlockNodeView: FC<
  BlockDocumentStatefulBlockNodeViewProps
> = ({node, selected, updateAttributes}) => {
  const {documentId, readOnly} = useBlockDocumentEditorContext();
  const attrs = unknownRecord(node.attrs);
  const blockId = optionalString(attrs.id) ?? '';
  const blockType = optionalString(attrs.blockType) ?? '';
  const blockInstanceId = optionalString(attrs.blockInstanceId) ?? blockId;
  const ownership = optionalString(attrs.ownership);
  const title = optionalString(attrs.title);
  const caption = optionalString(attrs.caption);
  const height = optionalNumber(attrs.height);
  const Renderer = useBlockDocumentStatefulBlockRenderer(blockType);
  const blockTypes = useBlockDocumentStatefulBlockTypes();
  const blockTypeConfig = blockTypes.find(
    (candidate) => candidate.blockType === blockType,
  );
  const resizableHeight = Boolean(blockTypeConfig?.resizableHeight);
  const minHeight = blockTypeConfig?.minHeight ?? 320;
  const maxHeight = blockTypeConfig?.maxHeight;
  const defaultHeight = blockTypeConfig?.defaultHeight ?? 560;
  const persistedHeight = resizableHeight
    ? clampHeight(height ?? defaultHeight, minHeight, maxHeight)
    : undefined;
  const [resizingHeight, setResizingHeight] = useState<number | null>(null);
  const resolvedHeight = resizingHeight ?? persistedHeight;

  const wrapperStyle = resolvedHeight ? {height: resolvedHeight} : undefined;

  const handleResizeMouseDown = (
    event: ReactMouseEvent<HTMLDivElement>,
  ) => {
    if (readOnly || !resizableHeight || !persistedHeight) return;
    event.preventDefault();
    event.stopPropagation();

    const startY = event.clientY;
    const startHeight = persistedHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextHeight = clampHeight(
        Math.round(startHeight + moveEvent.clientY - startY),
        minHeight,
        maxHeight,
      );
      setResizingHeight(nextHeight);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      const nextHeight = clampHeight(
        Math.round(startHeight + upEvent.clientY - startY),
        minHeight,
        maxHeight,
      );
      setResizingHeight(null);
      updateAttributes({height: nextHeight});
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <NodeViewWrapper
      className={cn(
        'not-prose bg-background group/stateful-block relative my-4 rounded-md border',
        selected && 'ring-ring ring-2',
      )}
      contentEditable={false}
      style={wrapperStyle}
    >
      {Renderer ? (
        createElement(Renderer, {
          documentId,
          blockId,
          blockType,
          blockInstanceId,
          ownership,
          title,
          caption,
          height: resolvedHeight,
          readOnly,
          onCaptionChange: (nextCaption: string | undefined) =>
            updateAttributes({caption: nextCaption}),
        })
      ) : (
        <div className="p-4">
          <div className="text-sm font-medium">Stateful block</div>
          <div className="text-muted-foreground mt-1 text-sm">
            No renderer is registered for {blockType || 'this block type'}.
          </div>
          <div className="text-muted-foreground mt-3 grid gap-1 text-xs">
            <span>Block type: {blockType || 'Unconfigured'}</span>
            <span>Instance: {blockInstanceId || 'Unconfigured'}</span>
            {ownership ? <span>Ownership: {ownership}</span> : null}
          </div>
        </div>
      )}
      {resizableHeight && !readOnly ? (
        <div
          className="absolute right-0 bottom-0 left-0 flex h-3 cursor-row-resize items-end justify-center opacity-0 transition-opacity group-hover/stateful-block:opacity-100"
          onMouseDown={handleResizeMouseDown}
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize block height"
        >
          <div className="bg-muted-foreground/50 mb-1 h-1 w-10 rounded-full" />
        </div>
      ) : null}
    </NodeViewWrapper>
  );
};
