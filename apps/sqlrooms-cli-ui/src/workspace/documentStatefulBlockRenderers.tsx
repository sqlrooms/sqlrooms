import type {
  BlockDocumentStatefulBlockRenderer,
  BlockDocumentStatefulBlockRendererProps,
} from '@sqlrooms/documents';
import type {FC} from 'react';
import type {CliCapabilityProfile} from '../profiles';
import {
  getStatefulBlockArtifactConfig,
  isStatefulBlockArtifactType,
  STATEFUL_BLOCK_ARTIFACT_TYPES,
  type StatefulBlockArtifactType,
} from '../statefulBlockArtifactConfigs';

export const ProfileDisabledStatefulBlockPlaceholder: FC<
  BlockDocumentStatefulBlockRendererProps
> = (props) => {
  const label = isStatefulBlockArtifactType(props.blockType)
    ? getStatefulBlockArtifactConfig(props.blockType).label
    : undefined;
  return (
    <div className="bg-muted/20 flex h-full min-h-40 items-center justify-center p-4 text-center">
      <div className="bg-background max-w-md rounded-md border p-4">
        <div className="text-sm font-medium">
          {props.caption || label || 'Disabled block'}
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          This block is disabled by the selected capability profile. Reopen this
          project with a profile that enables it to view and edit it.
        </p>
        <div className="text-muted-foreground mt-3 text-xs">
          Block type: {props.blockType}
        </div>
      </div>
    </div>
  );
};

export function createProfiledDocumentStatefulBlockRenderers(
  profile: CliCapabilityProfile,
  registeredRenderers: Record<
    StatefulBlockArtifactType,
    BlockDocumentStatefulBlockRenderer
  >,
): Record<StatefulBlockArtifactType, BlockDocumentStatefulBlockRenderer> {
  const renderers = {...registeredRenderers};
  const enabledBlockTypes = new Set<StatefulBlockArtifactType>(
    profile.blocks.stateful,
  );
  for (const blockType of STATEFUL_BLOCK_ARTIFACT_TYPES) {
    if (!enabledBlockTypes.has(blockType)) {
      renderers[blockType] = ProfileDisabledStatefulBlockPlaceholder;
    }
  }
  return renderers;
}
