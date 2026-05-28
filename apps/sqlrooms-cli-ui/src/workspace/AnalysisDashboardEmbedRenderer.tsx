import type {AnalysisArtifactEmbedRendererProps} from '@sqlrooms/documents';
import {MosaicDashboard} from '@sqlrooms/mosaic';
import {useEffect} from 'react';
import {useRoomStore} from '../store';

export const AnalysisDashboardEmbedRenderer = ({
  artifactId,
  artifactType,
  caption,
}: AnalysisArtifactEmbedRendererProps) => {
  const artifact = useRoomStore((state) =>
    state.artifacts.getArtifact(artifactId),
  );
  const ensureDashboardArtifact = useRoomStore(
    (state) => state.dashboard.ensureDashboardArtifact,
  );

  useEffect(() => {
    if (artifact?.type === 'dashboard') {
      ensureDashboardArtifact(artifactId);
    }
  }, [artifact?.type, artifactId, ensureDashboardArtifact]);

  if (!artifactId || artifactType !== 'dashboard') {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        Unsupported embedded artifact type: {artifactType || 'Unconfigured'}
      </div>
    );
  }

  if (!artifact || artifact.type !== 'dashboard') {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        Missing dashboard artifact: {artifactId}
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
        <MosaicDashboard dashboardId={artifactId} />
      </div>
    </div>
  );
};
