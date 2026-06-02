import type {MosaicDashboardBlockRenderProps} from './createMosaicDashboardBlockDefinition';
import {MosaicDashboard} from './MosaicDashboard';

export const DefaultMosaicDashboardBlock = ({
  blockId,
}: MosaicDashboardBlockRenderProps) => {
  return <MosaicDashboard dashboardId={blockId} />;
};
