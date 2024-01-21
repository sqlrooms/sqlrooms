import {FlowmapViewPanel, FlowmapViewStateProvider} from '@flowmapcity/flowmap';
import {FC} from 'react';
type Props = {
  // no props
};

const MainViewPanel: FC<Props> = () => {
  return (
    <FlowmapViewStateProvider viewId={'flowmap'}>
      <FlowmapViewPanel />
    </FlowmapViewStateProvider>
  );
};

export default MainViewPanel;
