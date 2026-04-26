import {Notebook} from '@sqlrooms/notebook';
import type {RoomPanelComponent} from '@sqlrooms/layout';

export const NotebookArtifact: RoomPanelComponent = ({panelId, meta}) => {
  const artifactId = (meta?.artifactId as string) ?? panelId;
  return <Notebook sheetId={artifactId} />;
};
