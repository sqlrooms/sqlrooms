import {FC, useCallback} from 'react';
import {useStoreWithMosaicDashboard, ColumnSelector} from '@sqlrooms/mosaic';
import type {MosaicDashboardPanelConfigType} from '@sqlrooms/mosaic';
import type {DataTable} from '@sqlrooms/duckdb';
import {regenerateMapConfigForTable} from './mapConfigUtils';
import {DeckMapDashboardPanelConfig} from './dashboardConfig';

interface LatitudeSelectorProps {
  dashboardId: string;
  panel: MosaicDashboardPanelConfigType;
  currentTable: DataTable;
  readOnly?: boolean;
}

export const LatitudeSelector: FC<LatitudeSelectorProps> = ({
  dashboardId,
  panel,
  currentTable,
  readOnly,
}) => {
  const updatePanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.updatePanel,
  );

  const mapConfig = panel.config as DeckMapDashboardPanelConfig;
  const currentLongitudeColumn = mapConfig?.fitToData?.longitudeColumn;
  const currentLatitudeColumn = mapConfig?.fitToData?.latitudeColumn;

  const handleChange = useCallback(
    (latitudeColumn: string) => {
      if (readOnly) return;

      const newConfig = regenerateMapConfigForTable(
        panel,
        currentTable,
        currentLongitudeColumn,
        latitudeColumn,
      );

      updatePanel(dashboardId, panel.id, {
        config: {...newConfig, settingsOpen: mapConfig?.settingsOpen} as any,
      });
    },
    [
      currentLongitudeColumn,
      panel,
      currentTable,
      updatePanel,
      dashboardId,
      readOnly,
      mapConfig?.settingsOpen,
    ],
  );

  return (
    <ColumnSelector.Numeric
      value={currentLatitudeColumn}
      onChange={handleChange}
      disabled={readOnly}
    />
  );
};
