import {PivotView} from '@sqlrooms/pivot';
import type {RoomPanelComponent} from '@sqlrooms/layout';

export const PivotPanel: RoomPanelComponent = ({panelId, meta}) => {
  const pivotId = (meta?.pivotId as string) ?? panelId;
  return <PivotView pivotId={pivotId} />;
};
