import {ArtifactTabs} from '@sqlrooms/artifacts';
import {RoomPanelComponent, useLayoutNodeContext} from '@sqlrooms/layout';
import {PivotView} from '@sqlrooms/pivot';
import {PlusIcon} from 'lucide-react';
import {useMemo} from 'react';
import {useRoomStore} from '../store';

export const MainView: RoomPanelComponent = () => {
  const ctx = useLayoutNodeContext();
  const artifactsConfig = useRoomStore((state) => state.artifacts.config);

  const pivotArtifacts = useMemo(
    () =>
      artifactsConfig.artifactOrder.filter(
        (artifactId) =>
          artifactsConfig.artifactsById[artifactId]?.type === 'pivot',
      ),
    [artifactsConfig.artifactsById, artifactsConfig.artifactOrder],
  );
  const fallbackPivotId = pivotArtifacts[0];

  if (ctx.containerType !== 'tabs') {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1">
          {fallbackPivotId ? <PivotView pivotId={fallbackPivotId} /> : null}
        </div>
      </div>
    );
  }

  return (
    <ArtifactTabs
      types={['pivot']}
      panelKey="artifact"
      closeable={true}
      preventCloseLastTab={false}
      emptyContent={
        <div className="flex h-full items-center justify-center p-6">
          <ArtifactTabs.NewButton artifactType="pivot" className="w-auto px-3">
            <PlusIcon className="h-4 w-4" /> Add pivot
          </ArtifactTabs.NewButton>
        </div>
      }
    >
      <ArtifactTabs.Tabs />
      <ArtifactTabs.NewButton artifactType="pivot" />
    </ArtifactTabs>
  );
};
