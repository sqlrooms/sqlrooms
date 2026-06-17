import {cn} from '@sqlrooms/ui';
import {NodeViewWrapper} from '@tiptap/react';
import {createElement, useCallback, type FC} from 'react';
import {useBlockDocumentChartRenderer} from '../../BlockDocumentChartRendererContext';
import {useBlockDocumentEditorContext} from '../BlockDocumentEditorContext';
import {optionalString, unknownRecord} from './nodeViewUtils';

type BlockDocumentChartNodeViewProps = {
  node: {attrs: Record<string, unknown>};
  selected: boolean;
  updateAttributes: (attrs: Record<string, unknown>) => void;
};

export const BlockDocumentChartNodeView: FC<
  BlockDocumentChartNodeViewProps
> = ({node, selected, updateAttributes}) => {
  const {documentId, readOnly} = useBlockDocumentEditorContext();
  const Renderer = useBlockDocumentChartRenderer();
  const attrs = unknownRecord(node.attrs);
  const blockId = optionalString(attrs.id) ?? '';
  const tableName = optionalString(attrs.tableName) ?? '';
  const selectionGroupId = optionalString(attrs.selectionGroupId);
  const caption = optionalString(attrs.caption);
  const config = attrs.config ?? {};
  const handleTableNameChange = useCallback(
    (nextTableName: string) => {
      if (readOnly) return;
      updateAttributes({tableName: nextTableName});
    },
    [readOnly, updateAttributes],
  );
  const handleConfigChange = useCallback(
    (nextConfig: unknown) => {
      if (readOnly) return;
      updateAttributes({config: nextConfig});
    },
    [readOnly, updateAttributes],
  );
  const handleCaptionChange = useCallback(
    (nextCaption: string | undefined) => {
      if (readOnly) return;
      updateAttributes({caption: nextCaption});
    },
    [readOnly, updateAttributes],
  );

  return (
    <NodeViewWrapper
      className={cn(
        'not-prose bg-background my-4 rounded-md border',
        selected && 'ring-ring ring-2',
      )}
      contentEditable={false}
      data-block-document-widget-node-view=""
    >
      {Renderer ? (
        createElement(Renderer, {
          documentId,
          blockId,
          tableName,
          config,
          selectionGroupId,
          caption,
          readOnly,
          onTableNameChange: handleTableNameChange,
          onConfigChange: handleConfigChange,
          onCaptionChange: handleCaptionChange,
        })
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
