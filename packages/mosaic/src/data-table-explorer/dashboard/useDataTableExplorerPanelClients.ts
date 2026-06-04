import {type MosaicClient} from '@uwdata/mosaic-core';
import {useMemo} from 'react';
import type {UseDataTableExplorerReturn} from '../types';
import type {ConnectionStatus} from '../../MosaicSlice';
import {DataTable} from '@sqlrooms/db';

/**
 * Extracts all Mosaic clients from a DataTableExplorer instance for panel client registration.
 * This includes:
 * - The main count client (tracks filtered row count)
 * - Histogram interactors (for histogram column interactions)
 * - Category clients (for category column interactions)
 */
export function useDataTableExplorerPanelClients(
  explorer: UseDataTableExplorerReturn,
  selectedTable: DataTable | undefined,
  connectionStatus: ConnectionStatus,
): MosaicClient[] {
  return useMemo<MosaicClient[]>(() => {
    if (!selectedTable || connectionStatus !== 'ready') {
      return [];
    }

    const clients: MosaicClient[] = [];

    // Add main count client
    if (explorer.client) {
      clients.push(explorer.client);
    }

    // Add summary clients (histogram interactors and category clients)
    explorer.columns.forEach((col) => {
      const summary = col.summary;
      if (summary.kind === 'histogram' && summary.interactor) {
        clients.push(summary.interactor);
      } else if (summary.kind === 'category' && summary.client) {
        clients.push(summary.client);
      }
    });

    return clients;
  }, [connectionStatus, explorer.client, explorer.columns, selectedTable]);
}
