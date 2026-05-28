import {cn} from '@sqlrooms/ui';
import {NodeViewWrapper} from '@tiptap/react';
import {createElement, type FC} from 'react';
import {useAnalysisChartRenderer} from '../../AnalysisChartRendererContext';
import {useAnalysisDocumentEditorContext} from '../AnalysisDocumentEditorContext';
import {optionalString, unknownRecord} from './nodeViewUtils';

type AnalysisChartNodeViewProps = {
  node: {attrs: Record<string, unknown>};
  selected: boolean;
  updateAttributes: (attrs: Record<string, unknown>) => void;
};

export const AnalysisChartNodeView: FC<AnalysisChartNodeViewProps> = ({
  node,
  selected,
  updateAttributes,
}) => {
  const {analysisId, readOnly} = useAnalysisDocumentEditorContext();
  const Renderer = useAnalysisChartRenderer();
  const attrs = unknownRecord(node.attrs);
  const blockId = optionalString(attrs.id) ?? '';
  const tableName = optionalString(attrs.tableName) ?? '';
  const selectionGroupId = optionalString(attrs.selectionGroupId);
  const caption = optionalString(attrs.caption);
  const config = attrs.config ?? {};

  return (
    <NodeViewWrapper
      className={cn(
        'not-prose bg-background my-4 rounded-md border',
        selected && 'ring-ring ring-2',
      )}
      contentEditable={false}
    >
      {Renderer ? (
        createElement(Renderer, {
          analysisId,
          blockId,
          tableName,
          config,
          selectionGroupId,
          caption,
          readOnly,
          onConfigChange: (nextConfig: unknown) =>
            updateAttributes({config: nextConfig}),
          onCaptionChange: (nextCaption: string | undefined) =>
            updateAttributes({caption: nextCaption}),
        })
      ) : (
        <div className="p-4">
          <div className="text-sm font-medium">Chart block</div>
          <div className="text-muted-foreground mt-1 text-sm">
            No analysis chart renderer is registered.
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
