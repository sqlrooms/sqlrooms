import type {BlocksDocumentArtifactEmbedRendererProps} from '@sqlrooms/documents';
import {PivotView} from '@sqlrooms/pivot';
import {useEffect} from 'react';
import {useRoomStore} from '../store';

export const AnalysisPivotEmbedRenderer = ({
  artifactId,
  artifactType,
  caption,
}: BlocksDocumentArtifactEmbedRendererProps) => {
  const artifact = useRoomStore((state) =>
    state.artifacts.getArtifact(artifactId),
  );
  const ensurePivot = useRoomStore((state) => state.pivot.ensurePivot);

  useEffect(() => {
    if (artifact?.type === 'pivot') {
      ensurePivot(artifactId, {title: artifact.title});
    }
  }, [artifact?.title, artifact?.type, artifactId, ensurePivot]);

  if (!artifactId || artifactType !== 'pivot') {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        Unsupported embedded artifact type: {artifactType || 'Unconfigured'}
      </div>
    );
  }

  if (!artifact || artifact.type !== 'pivot') {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        Missing pivot artifact: {artifactId}
      </div>
    );
  }

  return (
    <div className="flex h-[560px] min-h-[420px] flex-col">
      {caption ? (
        <div className="border-border shrink-0 border-b px-3 py-2 text-sm font-medium">
          {caption}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <PivotView pivotId={artifactId} />
      </div>
    </div>
  );
};
