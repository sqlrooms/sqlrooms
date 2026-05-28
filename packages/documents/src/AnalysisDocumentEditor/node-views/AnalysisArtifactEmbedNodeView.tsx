import {cn} from '@sqlrooms/ui';
import {NodeViewWrapper} from '@tiptap/react';
import {createElement, type FC} from 'react';
import {useAnalysisArtifactEmbedRenderer} from '../../AnalysisEmbedRendererContext';
import {useAnalysisDocumentEditorContext} from '../AnalysisDocumentEditorContext';
import {optionalString, unknownRecord} from './nodeViewUtils';

type AnalysisArtifactEmbedNodeViewProps = {
  node: {attrs: Record<string, unknown>};
  selected: boolean;
  updateAttributes: (attrs: Record<string, unknown>) => void;
};

export const AnalysisArtifactEmbedNodeView: FC<
  AnalysisArtifactEmbedNodeViewProps
> = ({node, selected, updateAttributes}) => {
  const {analysisId, readOnly} = useAnalysisDocumentEditorContext();
  const attrs = unknownRecord(node.attrs);
  const blockId = optionalString(attrs.id) ?? '';
  const artifactId = optionalString(attrs.artifactId) ?? '';
  const artifactType = optionalString(attrs.artifactType) ?? '';
  const caption = optionalString(attrs.caption);
  const Renderer = useAnalysisArtifactEmbedRenderer(artifactType);

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
          parentArtifactId: analysisId,
          blockId,
          artifactId,
          artifactType,
          caption,
          readOnly,
          onCaptionChange: (nextCaption: string | undefined) =>
            updateAttributes({caption: nextCaption}),
        })
      ) : (
        <div className="p-4">
          <div className="text-sm font-medium">Artifact embed</div>
          <div className="text-muted-foreground mt-1 text-sm">
            No renderer is registered for {artifactType || 'this artifact type'}
            .
          </div>
          <div className="text-muted-foreground mt-3 grid gap-1 text-xs">
            <span>Artifact: {artifactId || 'Unconfigured'}</span>
            <span>Type: {artifactType || 'Unconfigured'}</span>
          </div>
        </div>
      )}
    </NodeViewWrapper>
  );
};
