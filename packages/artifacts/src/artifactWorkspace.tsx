import {useCallback, useEffect, useMemo} from 'react';
import type {
  ArtifactTypeDefinition,
  ArtifactTypeDefinitions,
} from './ArtifactTypes';
import {useStoreWithArtifacts} from './ArtifactsSlice';
import type {ArtifactMetadata as ArtifactMetadataType} from './ArtifactsSliceConfig';

/** How an artifact workspace resolves selection when the current artifact is invalid. */
export type ArtifactWorkspaceSelectFallback = 'first' | 'none';

/** Artifact metadata plus presentation fields useful for menus and sidebars. */
export type ArtifactWorkspaceDescriptor = {
  id: string;
  name: string;
  type: string;
  icon?: ArtifactTypeDefinition<any>['icon'];
  artifact: ArtifactMetadataType;
};

/** Options for `useArtifactWorkspace`. */
export type UseArtifactWorkspaceOptions = {
  /**
   * Optional artifact type allowlist managed by this workspace.
   *
   * When omitted, the workspace manages every artifact type registered in the
   * room's artifacts slice.
   */
  types?: readonly string[];

  /**
   * Selection behavior when the persisted current artifact is missing or not
   * managed by this workspace.
   *
   * Defaults to `first`, which selects the first managed artifact and clears
   * the current artifact when no managed artifact exists.
   */
  selectFallback?: ArtifactWorkspaceSelectFallback;
};

/** Tab-free artifact collection state and actions for one artifact surface. */
export type UseArtifactWorkspaceResult = {
  artifactIds: string[];
  artifacts: ArtifactWorkspaceDescriptor[];
  selectedArtifactId?: string;
  selectedArtifact?: ArtifactMetadataType;
  artifactTypes: ArtifactTypeDefinitions<any>;
  createArtifact: (
    type?: string,
    options?: {
      title?: string;
    },
  ) => string | undefined;
  deleteArtifact: (artifactId: string) => void;
  renameArtifact: (artifactId: string, title: string) => void;
  selectArtifact: (artifactId: string) => void;
};

function isManagedType(types: readonly string[] | undefined, type: string) {
  return !types || types.includes(type);
}

function getDefaultArtifactType(
  artifactTypes: ArtifactTypeDefinitions<any>,
  managedTypes: readonly string[] | undefined,
) {
  if (!managedTypes) return Object.keys(artifactTypes)[0];
  const registeredType = managedTypes.find((type) => artifactTypes[type]);
  if (registeredType) return registeredType;
  return Object.keys(artifactTypes).length === 0 ? managedTypes[0] : undefined;
}

/**
 * Provides tab-free artifact collection, selection, and mutation actions.
 *
 * Use this when a surface needs to manage artifacts without adopting layout-tab
 * semantics. `ArtifactTabs` builds on this hook and adds the tab layout adapter
 * separately.
 */
export function useArtifactWorkspace(
  options: UseArtifactWorkspaceOptions = {},
): UseArtifactWorkspaceResult {
  const typesKey = options.types?.join('\u0000') ?? '';
  const managedTypes = useMemo(
    () => (options.types ? [...options.types] : undefined),
    // Keep inline arrays like types={['notebook']} stable by value.
    [typesKey],
  );
  const selectFallback = options.selectFallback ?? 'first';

  const artifactsConfig = useStoreWithArtifacts(
    (state) => state.artifacts.config,
  );
  const artifactTypes = useStoreWithArtifacts(
    (state) => state.artifacts.artifactTypes,
  );
  const createArtifactInStore = useStoreWithArtifacts(
    (state) => state.artifacts.createArtifact,
  );
  const deleteArtifactFromStore = useStoreWithArtifacts(
    (state) => state.artifacts.deleteArtifact,
  );
  const renameArtifactInStore = useStoreWithArtifacts(
    (state) => state.artifacts.renameArtifact,
  );
  const setCurrentArtifact = useStoreWithArtifacts(
    (state) => state.artifacts.setCurrentArtifact,
  );

  const artifactIds = useMemo(
    () =>
      artifactsConfig.artifactOrder.filter((artifactId) => {
        const artifact = artifactsConfig.artifactsById[artifactId];
        return artifact && isManagedType(managedTypes, artifact.type);
      }),
    [
      artifactsConfig.artifactOrder,
      artifactsConfig.artifactsById,
      managedTypes,
    ],
  );

  const artifacts = useMemo<ArtifactWorkspaceDescriptor[]>(
    () =>
      artifactIds
        .map((artifactId) => artifactsConfig.artifactsById[artifactId])
        .filter((artifact): artifact is ArtifactMetadataType =>
          Boolean(artifact),
        )
        .map((artifact) => ({
          id: artifact.id,
          name: artifact.title,
          type: artifact.type,
          icon: artifactTypes[artifact.type]?.icon,
          artifact,
        })),
    [artifactIds, artifactsConfig.artifactsById, artifactTypes],
  );

  const managedArtifactTypes = useMemo<ArtifactTypeDefinitions<any>>(() => {
    if (!managedTypes) return artifactTypes;
    return Object.fromEntries(
      Object.entries(artifactTypes).filter(([type]) =>
        managedTypes.includes(type),
      ),
    );
  }, [artifactTypes, managedTypes]);

  const selectedArtifactId = useMemo(() => {
    if (
      artifactsConfig.currentArtifactId &&
      artifactIds.includes(artifactsConfig.currentArtifactId)
    ) {
      return artifactsConfig.currentArtifactId;
    }
    return selectFallback === 'first' ? artifactIds[0] : undefined;
  }, [artifactIds, artifactsConfig.currentArtifactId, selectFallback]);

  const selectedArtifact = selectedArtifactId
    ? artifactsConfig.artifactsById[selectedArtifactId]
    : undefined;

  useEffect(() => {
    if (selectedArtifactId === artifactsConfig.currentArtifactId) return;
    setCurrentArtifact(selectedArtifactId);
  }, [
    artifactsConfig.currentArtifactId,
    selectedArtifactId,
    setCurrentArtifact,
  ]);

  const createArtifact = useCallback(
    (
      type?: string,
      createOptions?: {
        title?: string;
      },
    ) => {
      const artifactType =
        type ?? getDefaultArtifactType(artifactTypes, managedTypes);
      if (!artifactType || !isManagedType(managedTypes, artifactType)) {
        return undefined;
      }
      return createArtifactInStore({
        type: artifactType,
        title: createOptions?.title,
      });
    },
    [artifactTypes, createArtifactInStore, managedTypes],
  );

  const deleteArtifact = useCallback(
    (artifactId: string) => {
      deleteArtifactFromStore(artifactId);
    },
    [deleteArtifactFromStore],
  );

  const renameArtifact = useCallback(
    (artifactId: string, title: string) => {
      renameArtifactInStore(artifactId, title);
    },
    [renameArtifactInStore],
  );

  const selectArtifact = useCallback(
    (artifactId: string) => {
      if (artifactIds.includes(artifactId)) {
        setCurrentArtifact(artifactId);
      }
    },
    [artifactIds, setCurrentArtifact],
  );

  return useMemo(
    () => ({
      artifactIds,
      artifacts,
      selectedArtifactId,
      selectedArtifact,
      artifactTypes: managedArtifactTypes,
      createArtifact,
      deleteArtifact,
      renameArtifact,
      selectArtifact,
    }),
    [
      artifactIds,
      artifacts,
      createArtifact,
      deleteArtifact,
      managedArtifactTypes,
      renameArtifact,
      selectArtifact,
      selectedArtifact,
      selectedArtifactId,
    ],
  );
}
