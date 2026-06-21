import {FC, useCallback} from 'react';
import {useStoreWithMosaicDashboard, ColumnSelector} from '@sqlrooms/mosaic';
import type {MosaicDashboardPanelConfigType} from '@sqlrooms/mosaic';
import type {DataTable} from '@sqlrooms/duckdb';
import {regenerateMapConfigForTable} from './mapConfigUtils';
import {DeckMapDashboardPanelConfig} from './dashboardConfig';

interface LongitudeSelectorProps {
  dashboardId: string;
  panel: MosaicDashboardPanelConfigType;
  currentTable: DataTable;
}

export const LongitudeSelector: FC<LongitudeSelectorProps> = ({
  dashboardId,
  panel,
  currentTable,
}) => {
  const updatePanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.updatePanel,
  );

  const mapConfig = panel.config as DeckMapDashboardPanelConfig;
  const currentLongitudeColumn = mapConfig?.fitToData?.longitudeColumn;
  const currentLatitudeColumn = mapConfig?.fitToData?.latitudeColumn;

  const handleChange = useCallback(
    (longitudeColumn: string) => {
      if (!currentLatitudeColumn) return;

      const newConfig = regenerateMapConfigForTable(
        panel,
        currentTable,
        longitudeColumn,
        currentLatitudeColumn,
      );

      updatePanel(dashboardId, panel.id, {
        config: {...newConfig, settingsOpen: mapConfig?.settingsOpen} as any,
      });
    },
    [
      currentLatitudeColumn,
      panel,
      currentTable,
      updatePanel,
      dashboardId,
      mapConfig?.settingsOpen,
    ],
  );

  return (
    <ColumnSelector.Numeric
      value={currentLongitudeColumn}
      onChange={handleChange}
    />
  );
};
