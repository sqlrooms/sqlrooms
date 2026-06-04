import {useCallback, useMemo} from 'react';
import {type MosaicDashboardAddPanelAction} from './action-types';
import {useStoreWithMosaicDashboard} from './MosaicDashboardSlice';
import {useMosaicDashboardAddPanelActionContext} from './useMosaicDashboardAddPanelActionContext';

interface UseAddPanelActionsResult {
  actions: MosaicDashboardAddPanelAction[];
  canAddAnyPanel: boolean;
  canAddPanel: (action: MosaicDashboardAddPanelAction) => boolean;
  handleAddPanel: (action: MosaicDashboardAddPanelAction) => void;
}

export function useAddPanelActions(
  dashboardId: string,
): UseAddPanelActionsResult {
  const addPanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.addPanel,
  );
  const actions = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.addPanelActions,
  );

  const addPanelActionContext =
    useMosaicDashboardAddPanelActionContext(dashboardId);

  const canAddPanel = useCallback(
    (action: MosaicDashboardAddPanelAction) =>
      action.isEnabled ? action.isEnabled(addPanelActionContext) : true,
    [addPanelActionContext],
  );

  const canAddAnyPanel = useMemo(
    () => actions.some((action) => canAddPanel(action)),
    [actions, canAddPanel],
  );

  const handleAddPanel = (action: MosaicDashboardAddPanelAction) => {
    if (!canAddPanel(action)) {
      return;
    }

    const panel = action.createPanel(addPanelActionContext);

    if (panel) {
      addPanel(dashboardId, panel);
    }
  };

  return {
    actions,
    canAddAnyPanel,
    canAddPanel,
    handleAddPanel,
  };
}
