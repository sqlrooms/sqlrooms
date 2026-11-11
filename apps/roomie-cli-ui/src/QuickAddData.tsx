import {useRef, useState} from 'react';
import {roomStore} from './store';
import {
  commitDataImport,
  inferDataFileFormat,
  prepareDataImport,
  suggestImportTableName,
} from './dataImport';

/** Explicit sidebar shortcut for importing dropped files without a preview step. */
export function QuickAddData() {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const busy = useRef(false);
  const importFiles = async (files: File[]) => {
    if (busy.current || !files.length) return;
    busy.current = true;
    setErrors([]);
    let imported = 0;
    const failures: string[] = [];
    try {
      for (const file of files) {
        setStatus(`Adding ${file.name}…`);
        try {
          if (!inferDataFileFormat(file.name))
            throw new Error('Use CSV, Parquet, JSON, or JSONL.');
          const name = suggestImportTableName(
            file.name,
            roomStore.getState().db.tables.map((table) => table.table.table),
          );
          const source = await prepareDataImport({kind: 'file', file});
          await commitDataImport(source, name);
          imported++;
        } catch (error) {
          failures.push(
            `${file.name}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      setErrors(failures);
      setStatus(`Added ${imported} ${imported === 1 ? 'file' : 'files'}.`);
    } finally {
      busy.current = false;
    }
  };
  return (
    <div
      className={`my-2 rounded-md border border-dashed p-3 text-xs ${dragging ? 'border-primary bg-accent' : 'border-border'}`}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = busy.current ? 'none' : 'copy';
        setDragging(!busy.current);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void importFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <p className="font-medium">Drop files to add immediately</p>
      <p className="text-muted-foreground mt-1">Automatic names · no preview</p>
      <p role="status" className="mt-1 break-words">
        {status}
      </p>
      {errors.length > 0 && (
        <p
          role="alert"
          className="text-destructive mt-1 break-words whitespace-pre-wrap"
        >
          {errors.join('\n')}
        </p>
      )}
    </div>
  );
}
