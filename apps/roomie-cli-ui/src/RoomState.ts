import type {RoomShellSliceState} from '@sqlrooms/room-shell';
import type {ArtifactsSliceState} from '@sqlrooms/artifacts';
import type {BlockDocumentsSliceState} from '@sqlrooms/documents';
import type {HtmlAppRuntimeSliceState} from '@sqlrooms/app-runtime';
import type {
  MosaicSliceState,
  MosaicDashboardFeatureSlicesState,
} from '@sqlrooms/mosaic';
import type {z} from 'zod';
import type {TableSettings} from './model';

/** Roomie's minimal persisted domain; no AI, provider, or CRDT slices. */
export type RoomState = RoomShellSliceState &
  ArtifactsSliceState &
  BlockDocumentsSliceState &
  HtmlAppRuntimeSliceState &
  MosaicSliceState &
  MosaicDashboardFeatureSlicesState & {
    tableExplorers: {
      config: {byId: Record<string, z.infer<typeof TableSettings>>};
      update: (id: string, settings: z.infer<typeof TableSettings>) => void;
    };
  };
