import {
  createEmptyBlockDocumentContent,
  type BlockDocumentContent,
} from '@sqlrooms/documents';
import {useMutation} from '@tanstack/react-query';
import {useEffect, useMemo, useState} from 'react';
import type {JsonObject} from '#/lib/json';
import type {WorkspaceDuckDbRuntimeState} from './worksheet/useWorkspaceDuckDbRuntime';
import {
  createWebWorksheetRoomStore,
  normalizeWorksheetBlockDocumentContent,
  useRefreshWorksheetDbSchemas,
  useSerializedWorksheetContent,
  WebWorksheetRoomProvider,
  WorksheetBlockDocument,
} from './worksheet/worksheetRoomStore';

type WorksheetSurfaceProps = {
  worksheet: {
    id: string;
    title: string;
    content: JsonObject;
  };
  token: string | null;
  workspaceId: string | null;
  duckDbRuntime: WorkspaceDuckDbRuntimeState;
};

export function WorksheetSurface({
  worksheet,
  token,
  workspaceId,
  duckDbRuntime,
}: WorksheetSurfaceProps) {
  const runtime = duckDbRuntime.runtime;
  const content = useMemo(
    () => toBlockDocumentContent(worksheet.content),
    [worksheet.content],
  );
  const roomStore = useMemo(() => {
    if (!runtime) return null;
    return createWebWorksheetRoomStore({
      connector: runtime.connector,
      content,
      worksheetId: worksheet.id,
    });
  }, [content, runtime, worksheet.id]);

  if (!roomStore) {
    return (
      <div className="worksheet-document-surface">
        <div className="worksheet-block-placeholder">
          {duckDbRuntime.status === 'error'
            ? duckDbRuntime.error ?? 'Could not prepare the workspace runtime.'
            : 'Preparing workspace'}
        </div>
      </div>
    );
  }

  return (
    <WebWorksheetRoomProvider roomStore={roomStore}>
      <WorksheetSurfaceContent
        tableNames={duckDbRuntime.tableNames}
        token={token}
        worksheet={worksheet}
        workspaceId={workspaceId}
      />
    </WebWorksheetRoomProvider>
  );
}

function WorksheetSurfaceContent({
  tableNames,
  token,
  worksheet,
  workspaceId,
}: {
  tableNames: string[];
  token: string | null;
  worksheet: WorksheetSurfaceProps['worksheet'];
  workspaceId: string | null;
}) {
  const [title, setTitle] = useState(worksheet.title);
  const content = useSerializedWorksheetContent(worksheet.id);

  useRefreshWorksheetDbSchemas(tableNames);

  useEffect(() => {
    setTitle(worksheet.title);
  }, [worksheet.id, worksheet.title]);

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      data: {
        token: string;
        workspaceId: string;
        worksheetId: string;
        title: string;
        content: JsonObject;
      };
    }) => {
      const {saveWorksheetContent} = await import('./workspace/worksheets');
      return saveWorksheetContent(payload);
    },
  });

  useEffect(() => {
    if (!token || !workspaceId) return;
    const timeout = window.setTimeout(() => {
      void saveMutation.mutateAsync({
        data: {
          token,
          workspaceId,
          worksheetId: worksheet.id,
          title,
          content,
        },
      });
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [content, saveMutation, title, token, workspaceId, worksheet.id]);

  return (
    <div className="worksheet-document-surface">
      <WorksheetBlockDocument
        worksheetId={worksheet.id}
        title={title}
        onTitleChange={setTitle}
      />
    </div>
  );
}

function toBlockDocumentContent(content: JsonObject): BlockDocumentContent {
  if (content.type === 'doc' && Array.isArray(content.content)) {
    return normalizeWorksheetBlockDocumentContent(
      content as unknown as BlockDocumentContent,
    );
  }
  return createEmptyBlockDocumentContent();
}
