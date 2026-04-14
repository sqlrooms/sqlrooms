import {useCellsStore} from '@sqlrooms/cells';
import {RoomPanelComponent} from '@sqlrooms/layout';
import {createElement} from 'react';
import {ARTIFACT_TYPES} from '../artifactTypes';

export const ArtifactSheet: RoomPanelComponent = (props) => {
  const {panelInfo} = props;
  const {panelId} = panelInfo;

  // const currentSheet = useCellsStore((s) => {
  //   const id = s.cells.config.currentSheetId;
  //   return id ? s.cells.config.sheets[id] : undefined;
  // });

  const panelSheet = useCellsStore((s) => s.cells.config.sheets[panelId]);

  return (
    <>
      {!panelSheet && (
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground text-sm">
            No sheets yet. Create one from the tab bar above.
          </p>
        </div>
      )}
      {panelSheet?.type &&
        createElement(ARTIFACT_TYPES[panelSheet.type].component, {})}
    </>
  );
};
