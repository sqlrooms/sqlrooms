import {KeplerSidePanels} from '@sqlrooms/kepler';
import {
  FileDataSourcesPanel,
  ProjectBuilderPanel,
  TablesListPanel,
} from '@sqlrooms/project-builder';
import {ProjectPanelTypes, useProjectStore} from '../store';

export function KeplerSidePanelLayerManager() {
  const currentMap = useProjectStore((state) => {
    return state.kepler.getCurrentMap();
  });
  return (
    <ProjectBuilderPanel type={ProjectPanelTypes.enum['kepler-layers']}>
      <KeplerSidePanels panelId="layer" mapId={currentMap?.id || ''} />
    </ProjectBuilderPanel>
  );
}

export function KeplerSidePanelFilterManager() {
  const currentMap = useProjectStore((state) => {
    return state.kepler.getCurrentMap();
  });
  return (
    <ProjectBuilderPanel type={ProjectPanelTypes.enum['kepler-filters']}>
      <KeplerSidePanels panelId="filter" mapId={currentMap?.id || ''} />
    </ProjectBuilderPanel>
  );
}

export function KeplerSidePanelBaseMapManager() {
  const currentMap = useProjectStore((state) => {
    return state.kepler.getCurrentMap();
  });
  return (
    <ProjectBuilderPanel type={ProjectPanelTypes.enum['kepler-basemaps']}>
      <KeplerSidePanels panelId="map" mapId={currentMap?.id || ''} />
    </ProjectBuilderPanel>
  );
}

export function KeplerSidePanelInteractionManager() {
  const currentMap = useProjectStore((state) => {
    return state.kepler.getCurrentMap();
  });
  return (
    <ProjectBuilderPanel type={ProjectPanelTypes.enum['kepler-interactions']}>
      <KeplerSidePanels panelId="interaction" mapId={currentMap?.id || ''} />
    </ProjectBuilderPanel>
  );
}
