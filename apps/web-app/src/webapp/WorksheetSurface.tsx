import {useBaseRoomStore} from '@sqlrooms/room-store';
import type {JsonObject} from '#/lib/json';
import type {WorkspaceRoomState} from './workspace/WorkspaceRoomStore';
import {
  useRefreshWorksheetDbSchemas,
  WorksheetBlockDocument,
} from './worksheet/WorksheetArtifact';

type WorksheetSurfaceProps = {
  worksheet: {
    id: string;
    title: string;
    content: JsonObject;
  };
  tableNames: string[];
};

export function WorksheetSurface({
  worksheet,
  tableNames,
}: WorksheetSurfaceProps) {
  useRefreshWorksheetDbSchemas(tableNames);

  const title = useBaseRoomStore<WorkspaceRoomState, string>(
    (state) =>
      state.artifacts.config.artifactsById[worksheet.id]?.title ??
      worksheet.title,
  );
  const renameArtifact = useBaseRoomStore<
    WorkspaceRoomState,
    WorkspaceRoomState['artifacts']['renameArtifact']
  >((state) => state.artifacts.renameArtifact);

  return (
    <div className="worksheet-document-surface">
      <WorksheetBlockDocument
        worksheetId={worksheet.id}
        title={title || 'Worksheet'}
        onTitleChange={(nextTitle) =>
          renameArtifact(worksheet.id, nextTitle || 'Worksheet')
        }
      />
    </div>
  );
}
