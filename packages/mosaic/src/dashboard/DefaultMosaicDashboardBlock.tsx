import type {StatefulBlockRenderProps} from '@sqlrooms/blocks';
import {MosaicDashboard} from './MosaicDashboard';
import type {MosaicDashboardSliceState} from './MosaicDashboardSlice';
import {FC} from 'react';

export const DefaultMosaicDashboardBlock: FC<
  StatefulBlockRenderProps<MosaicDashboardSliceState>
> = ({blockId}) => {
  return <MosaicDashboard dashboardId={blockId} />;
};
