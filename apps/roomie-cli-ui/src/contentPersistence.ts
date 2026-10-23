import {blockDocumentContentToBlocks} from '@sqlrooms/documents';
import {z} from 'zod';
import {TableSettings, Workspace} from './model';
import {contentSchemas, RoomieContent} from './stateOwnership';
import type {RoomState} from './RoomState';

/** Version 2 owns content only; browser view state is never merged from it. */
export const ContentWorkspace = z.strictObject({
  application: z.literal('roomie'),
  schemaVersion: z.literal(2),
  ...contentSchemas,
});

/** Hydrate content without introducing or overwriting any browser view fields. */
export function mergeRoomieContent(
  current: RoomState,
  content: RoomieContent,
): RoomState {
  return {
    ...current,
    artifacts: {
      ...current.artifacts,
      config: {...current.artifacts.config, ...content.artifacts},
    },
    blockDocuments: {...current.blockDocuments, config: content.blockDocuments},
    mosaicDashboard: {
      ...current.mosaicDashboard,
      config: content.mosaicDashboard,
    },
    htmlApps: {...current.htmlApps, config: content.htmlApps},
  };
}

/** Validate either legacy or content-only storage, discarding legacy view state. */
export function parseContentWorkspace(value: unknown): RoomieContent {
  const version = z
    .object({schemaVersion: z.number()})
    .parse(value).schemaVersion;
  if (version === 1) return RoomieContent.parse(Workspace.parse(value));
  const content = ContentWorkspace.parse(value);
  // Retain the existing document/panel integrity validation. Table preferences
  // are local now, so validate backing table blocks with their default view.
  const byId = Object.fromEntries(
    Object.values(content.blockDocuments.artifacts)
      .flatMap((document) => blockDocumentContentToBlocks(document.content))
      .filter(
        (block) =>
          block.type === 'statefulBlock' && block.blockType === 'data-table',
      )
      .map((block) => [
        block.type === 'statefulBlock' ? block.blockInstanceId : '',
        TableSettings.parse({}),
      ]),
  );
  Workspace.parse({...content, schemaVersion: 1, tableExplorers: {byId}});
  return RoomieContent.parse(content);
}
