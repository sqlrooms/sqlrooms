import {cn} from '@sqlrooms/ui';
import {NodeViewWrapper, type Editor} from '@tiptap/react';
import {
  createElement,
  memo,
  useCallback,
  useEffect,
  useRef,
  type FC,
} from 'react';
import {
  type BlockDocumentChartRenderer,
  type BlockDocumentChartRendererProps,
  useBlockDocumentChartRenderer,
} from '../../BlockDocumentChartRendererContext';
import {useBlockDocumentEditorContext} from '../BlockDocumentEditorContext';
import {optionalString, unknownRecord} from './nodeViewUtils';

type BlockDocumentChartNodeViewProps = {
  node: {attrs: Record<string, unknown>};
  selected: boolean;
  updateAttributes: (attrs: Record<string, unknown>) => void;
  getPos: () => number | undefined;
  editor: Editor;
};

type ChartRendererBoundaryProps = BlockDocumentChartRendererProps & {
  Renderer: BlockDocumentChartRenderer;
};

const EMPTY_CHART_CONFIG: Record<string, never> = {};

const ChartRendererBoundary = memo(
  ({Renderer, ...props}: ChartRendererBoundaryProps) =>
    createElement(Renderer, props),
);

ChartRendererBoundary.displayName = 'ChartRendererBoundary';

/** Renders a chart block as a Tiptap node view inside the block document editor. */
export const BlockDocumentChartNodeView: FC<
  BlockDocumentChartNodeViewProps
> = ({node, selected, updateAttributes, getPos, editor}) => {
  const {documentId, readOnly} = useBlockDocumentEditorContext();
  const Renderer = useBlockDocumentChartRenderer();
  const updateAttributesRef = useRef(updateAttributes);
  const readOnlyRef = useRef(readOnly);
  const attrs = unknownRecord(node.attrs);
  const blockId = optionalString(attrs.id) ?? '';
  const tableName = optionalString(attrs.tableName) ?? '';
  const selectionGroupId = optionalString(attrs.selectionGroupId);
  const caption = optionalString(attrs.caption);
  const config = attrs.config ?? EMPTY_CHART_CONFIG;

  useEffect(() => {
    updateAttributesRef.current = updateAttributes;
  }, [updateAttributes]);

  useEffect(() => {
    readOnlyRef.current = readOnly;
  }, [readOnly]);

  const handleTableNameChange = useCallback((nextTableName: string) => {
    if (readOnlyRef.current) return;
    updateAttributesRef.current({tableName: nextTableName});
  }, []);
  const handleConfigChange = useCallback((nextConfig: unknown) => {
    if (readOnlyRef.current) return;
    updateAttributesRef.current({config: nextConfig});
  }, []);
  const handleCaptionChange = useCallback((nextCaption: string | undefined) => {
    if (readOnlyRef.current) return;
    updateAttributesRef.current({caption: nextCaption});
  }, []);

  const handleClick = useCallback(() => {
    // Select this node when clicked
    // Panel selection will be cleared automatically by useSelectedBlockOrPanel hook
    if (editor && !selected) {
      const pos = getPos();
      if (pos !== undefined) {
        editor.commands.setNodeSelection(pos);
      }
    }
  }, [editor, selected, getPos]);

  return (
    <NodeViewWrapper
      className={cn(
        'not-prose bg-background my-4 rounded-md border',
        selected && 'outline-primary rounded-none outline outline-2',
      )}
      contentEditable={false}
      data-block-document-widget-node-view=""
      onClick={handleClick}
    >
      {Renderer ? (
        <ChartRendererBoundary
          Renderer={Renderer}
          documentId={documentId}
          blockId={blockId}
          tableName={tableName}
          config={config}
          selectionGroupId={selectionGroupId}
          caption={caption}
          readOnly={readOnly}
          onTableNameChange={handleTableNameChange}
          onConfigChange={handleConfigChange}
          onCaptionChange={handleCaptionChange}
        />
      ) : (
        <div className="p-4">
          <div className="text-sm font-medium">Chart block</div>
          <div className="text-muted-foreground mt-1 text-sm">
            No block document chart renderer is registered.
          </div>
          <div className="text-muted-foreground mt-3 grid gap-1 text-xs">
            <span>Table: {tableName || 'Unconfigured'}</span>
            {selectionGroupId ? (
              <span>Selection group: {selectionGroupId}</span>
            ) : null}
          </div>
        </div>
      )}
    </NodeViewWrapper>
  );
};
