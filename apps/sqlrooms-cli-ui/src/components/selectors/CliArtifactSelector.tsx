import type {ArtifactMetadata} from '@sqlrooms/artifacts';
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sqlrooms/ui';
import {ChevronDownIcon, FileStackIcon} from 'lucide-react';
import {useCallback} from 'react';
import {useRoomStore} from '../../roomStoreHooks';

/** Returns whether linked artifacts require a menu beyond the active artifact. */
export function shouldShowArtifactSelectorMenu(
  currentArtifactId: string,
  sessionArtifacts: Pick<ArtifactMetadata, 'id'>[],
): boolean {
  return sessionArtifacts.some((artifact) => artifact.id !== currentArtifactId);
}

export function CliArtifactSelector({
  currentArtifact,
  sessionArtifacts,
}: {
  currentArtifact: ArtifactMetadata;
  sessionArtifacts: ArtifactMetadata[];
}) {
  const artifactTypes = useRoomStore((state) => state.artifacts.artifactTypes);
  const setCurrentArtifact = useRoomStore(
    (state) => state.artifacts.setCurrentArtifact,
  );
  const setShowArtifactChooser = useRoomStore(
    (state) => state.workspaceUi.setShowArtifactChooser,
  );

  const handleSelect = useCallback(
    (artifactId: string) => {
      setCurrentArtifact(artifactId);
      setShowArtifactChooser(false);
    },
    [setCurrentArtifact, setShowArtifactChooser],
  );

  const renderIcon = (artifact: ArtifactMetadata) => {
    const Icon = artifactTypes[artifact.type]?.icon ?? FileStackIcon;
    return <Icon className="h-4 w-4 shrink-0" aria-hidden />;
  };

  if (!shouldShowArtifactSelectorMenu(currentArtifact.id, sessionArtifacts)) {
    return (
      <div className="flex h-9 max-w-full min-w-0 items-center gap-2 px-2 text-sm font-medium">
        {renderIcon(currentArtifact)}
        <span className="truncate">{currentArtifact.title}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 max-w-full min-w-0 gap-2 px-2"
          aria-label="Switch artifact"
        >
          {renderIcon(currentArtifact)}
          <span className="truncate">{currentArtifact.title}</span>
          <ChevronDownIcon className="h-4 w-4 shrink-0" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-96 overflow-y-auto">
        {sessionArtifacts.map((artifact) => (
          <DropdownMenuItem
            key={artifact.id}
            className={cn(artifact.id === currentArtifact.id && 'bg-accent')}
            onSelect={() => handleSelect(artifact.id)}
          >
            {renderIcon(artifact)}
            <span className="truncate">{artifact.title}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
