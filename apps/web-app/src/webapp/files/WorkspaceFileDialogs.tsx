import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sqlrooms/ui';
import type {
  FileConflictResolution,
  FileNameConflict,
  TablePreview,
} from './useWorkspaceFileWorkflow';

export function WorkspaceFileDialogs({
  tablePreview,
  fileNameConflict,
  onCloseTablePreview,
  onResolveFileNameConflict,
}: {
  tablePreview: TablePreview | null;
  fileNameConflict: FileNameConflict | null;
  onCloseTablePreview: () => void;
  onResolveFileNameConflict: (resolution: FileConflictResolution) => void;
}) {
  return (
    <>
      <Dialog
        open={Boolean(tablePreview)}
        onOpenChange={(open) => {
          if (!open) onCloseTablePreview();
        }}
      >
        <DialogContent className="table-preview-dialog">
          <DialogHeader>
            <DialogTitle>{tablePreview?.tableName ?? 'Table'}</DialogTitle>
            <DialogDescription>Preview of the first 25 rows.</DialogDescription>
          </DialogHeader>
          <div className="table-preview-body">
            {tablePreview?.status === 'loading' ? (
              <div className="table-preview-empty">Loading preview</div>
            ) : null}
            {tablePreview?.status === 'error' ? (
              <div className="table-preview-empty">{tablePreview.error}</div>
            ) : null}
            {tablePreview?.status === 'ready' &&
            tablePreview.rows.length === 0 ? (
              <div className="table-preview-empty">No rows</div>
            ) : null}
            {tablePreview?.status === 'ready' &&
            tablePreview.rows.length > 0 ? (
              <table className="table-preview-grid">
                <thead>
                  <tr>
                    {tablePreview.columns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tablePreview.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {tablePreview.columns.map((column) => (
                        <td key={column}>{formatPreviewCell(row[column])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" onClick={onCloseTablePreview}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(fileNameConflict)}
        onOpenChange={(open) => {
          if (!open && fileNameConflict) {
            onResolveFileNameConflict({action: 'cancel'});
          }
        }}
      >
        <DialogContent className="file-conflict-dialog">
          <DialogHeader className="sign-in-dialog-header">
            <DialogTitle className="sign-in-dialog-title">
              Table already exists
            </DialogTitle>
            <DialogDescription className="sign-in-dialog-description">
              {fileNameConflict
                ? `"${fileNameConflict.tableName}" already exists. How should SQLRooms add "${fileNameConflict.fileName}"?`
                : null}
            </DialogDescription>
          </DialogHeader>
          {fileNameConflict ? (
            <p className="file-conflict-detail">
              Keeping both will add the new table as "
              {fileNameConflict.uniqueTableName}".
            </p>
          ) : null}
          <div className="file-conflict-actions">
            <Button
              variant="ghost"
              type="button"
              onClick={() => onResolveFileNameConflict({action: 'cancel'})}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={() =>
                fileNameConflict
                  ? onResolveFileNameConflict({
                      action: 'keep-both',
                      tableName: fileNameConflict.uniqueTableName,
                    })
                  : undefined
              }
            >
              Keep both
            </Button>
            <Button
              type="button"
              onClick={() => onResolveFileNameConflict({action: 'replace'})}
            >
              Replace
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatPreviewCell(value: unknown) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
