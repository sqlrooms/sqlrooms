import type {RoomPanelComponent} from '@sqlrooms/layout';
import {Notebook} from '@sqlrooms/notebook';

export const NotebookPanel: RoomPanelComponent = ({panelId, meta}) => {
  const artifactId = (meta?.artifactId as string) ?? panelId;

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <Notebook artifactId={artifactId} />
      </div>
    </div>
  );
};
