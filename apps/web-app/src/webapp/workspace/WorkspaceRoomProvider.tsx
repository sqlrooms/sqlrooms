import type {LayoutNode, Panels} from '@sqlrooms/layout';
import type {StoreApi} from '@sqlrooms/room-store';
import {useEffect, useMemo, useRef} from 'react';
import type {JsonObject} from '#/lib/json';
import type {useWorkspaceDuckDbRuntime} from '../worksheet/useWorkspaceDuckDbRuntime';
import {
  createWorkspaceRoomPersistence,
  createWorkspaceRoomStore,
  type WorkspaceRoomPersistence,
  type WorkspaceRoomSnapshot,
  type WorkspaceRoomState,
} from './WorkspaceRoomStore';
import {getWorkspaceHydrationKey} from './workspaceContent';

export type SaveWorkspaceRoomSnapshot = (
  snapshot: WorkspaceRoomSnapshot,
) => Promise<void>;

export function WorkspaceRoomProvider({
  workspaceKey,
  layout,
  aiConfig,
  content,
  panels,
  token,
  duckDbRuntime,
  onRoomStoreChange,
  saveRoomSnapshot,
  children,
}: {
  workspaceKey: string;
  layout: LayoutNode;
  aiConfig: JsonObject;
  content: JsonObject | undefined;
  panels: Panels;
  token: string | null;
  duckDbRuntime: ReturnType<typeof useWorkspaceDuckDbRuntime>;
  onRoomStoreChange: (roomStore: StoreApi<WorkspaceRoomState> | null) => void;
  saveRoomSnapshot: SaveWorkspaceRoomSnapshot | null;
  children: (roomStore: StoreApi<WorkspaceRoomState> | null) => React.ReactNode;
}) {
  const initialLayoutRef = useRef(layout);
  const initialPanelsRef = useRef(panels);
  const initialAiConfigRef = useRef(aiConfig);
  const hydratedRoomStoreRef = useRef<StoreApi<WorkspaceRoomState> | null>(
    null,
  );
  const hydratedPersistenceRef = useRef<WorkspaceRoomPersistence | null>(null);
  const duckDbConnector = duckDbRuntime.runtime?.connector;
  const workspaceHydrationKey = useMemo(
    () => getWorkspaceHydrationKey(content),
    [content],
  );
  const roomStore = useMemo(() => {
    if (!duckDbConnector) return null;

    return createWorkspaceRoomStore({
      workspaceKey,
      layout: initialLayoutRef.current,
      aiConfig: initialAiConfigRef.current,
      panels: initialPanelsRef.current,
      token,
      duckDbConnector,
    });
  }, [duckDbConnector, workspaceKey]);

  useEffect(() => {
    onRoomStoreChange(roomStore);
    return () => onRoomStoreChange(null);
  }, [onRoomStoreChange, roomStore]);

  const roomPersistence = useMemo<WorkspaceRoomPersistence | null>(() => {
    if (!roomStore || !saveRoomSnapshot) return null;

    return createWorkspaceRoomPersistence({
      roomStore,
      save: saveRoomSnapshot,
    });
  }, [roomStore, saveRoomSnapshot]);

  useEffect(() => {
    if (!roomStore) return;
    const hydrateFromProps = () => {
      roomStore.getState().workspace.hydrateContent(content);

      roomStore.getState().workspace.hydrateLayout(layout);

      roomStore.getState().workspace.hydrateAiConfig(aiConfig);
    };

    const shouldHydrateRoomStore =
      hydratedRoomStoreRef.current !== roomStore ||
      Boolean(
        roomPersistence && hydratedPersistenceRef.current !== roomPersistence,
      );

    if (!shouldHydrateRoomStore) {
      return;
    }

    if (!roomPersistence) {
      hydrateFromProps();
      hydratedRoomStoreRef.current = roomStore;
      return;
    }

    void roomPersistence.controller
      .pause(hydrateFromProps)
      .then(() => {
        hydratedRoomStoreRef.current = roomStore;
        hydratedPersistenceRef.current = roomPersistence;
        roomPersistence.markStateSnapshotSaved(roomStore.getState());
      })
      .catch((error: unknown) => {
        roomStore.getState().room.captureException(error);
      });
  }, [
    aiConfig,
    content,
    layout,
    roomStore,
    roomPersistence,
    workspaceHydrationKey,
  ]);

  useEffect(() => {
    if (!roomStore) return;
    roomStore.getState().workspace.setAssistantToken(token);
  }, [roomStore, token]);

  useEffect(() => {
    if (!roomPersistence) return;

    const flushNow = () => {
      void roomPersistence.flush('final-flush').catch((error: unknown) => {
        roomStore?.getState().room.captureException(error);
      });
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') {
        flushNow();
      }
    };
    window.addEventListener('beforeunload', flushNow);
    document.addEventListener('visibilitychange', flushWhenHidden);

    return () => {
      window.removeEventListener('beforeunload', flushNow);
      document.removeEventListener('visibilitychange', flushWhenHidden);
      void roomPersistence.flush('final-flush').catch((error: unknown) => {
        roomStore?.getState().room.captureException(error);
      });
    };
  }, [roomPersistence, roomStore]);

  return children(roomStore);
}
