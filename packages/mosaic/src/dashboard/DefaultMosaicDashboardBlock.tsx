import type {StatefulBlockRenderProps} from '@sqlrooms/blocks';
import {MosaicDashboard} from './MosaicDashboard';
import type {MosaicDashboardSliceState} from './MosaicDashboardSlice';

export const DefaultMosaicDashboardBlock = ({
  blockId,
}: StatefulBlockRenderProps<MosaicDashboardSliceState>) => {
  return <MosaicDashboard dashboardId={blockId} />;
};
