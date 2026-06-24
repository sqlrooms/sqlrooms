import {type DataTable} from '@sqlrooms/db';
import {useState} from 'react';

export function useConfirmDatasetChange(
  onConfirmed: (table: DataTable) => void,
) {
  const [pendingTable, setPendingTable] = useState<DataTable | null>(null);

  const handleTableChangeRequest = (table: DataTable) => {
    setPendingTable(table);
  };

  const handleConfirm = () => {
    if (pendingTable) {
      onConfirmed(pendingTable);
      setPendingTable(null);
    }
  };

  const handleCancel = () => {
    setPendingTable(null);
  };

  return {
    pendingTable,
    handleTableChangeRequest,
    handleConfirm,
    handleCancel,
    isDialogOpen: pendingTable !== null,
  };
}
