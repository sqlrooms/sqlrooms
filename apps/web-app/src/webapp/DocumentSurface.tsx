import {useBaseRoomStore} from '@sqlrooms/room-store';
import type {JsonObject} from '#/lib/json';
import type {WorkspaceRoomState} from './workspace/WorkspaceRoomStore';
import {
  useRefreshDocumentDbSchemas,
  DocumentBlockDocument,
} from './document/DocumentArtifact';

type DocumentSurfaceProps = {
  document: {
    id: string;
    title: string;
    content: JsonObject;
  };
  tableNames: string[];
};

export function DocumentSurface({document, tableNames}: DocumentSurfaceProps) {
  useRefreshDocumentDbSchemas(tableNames);

  const title = useBaseRoomStore<WorkspaceRoomState, string>(
    (state) =>
      state.artifacts.config.artifactsById[document.id]?.title ??
      document.title,
  );
  const renameArtifact = useBaseRoomStore<
    WorkspaceRoomState,
    WorkspaceRoomState['artifacts']['renameArtifact']
  >((state) => state.artifacts.renameArtifact);

  return (
    <div className="document-surface">
      <DocumentBlockDocument
        documentId={document.id}
        title={title || 'Document'}
        onTitleChange={(nextTitle) =>
          renameArtifact(document.id, nextTitle || 'Document')
        }
      />
    </div>
  );
}
