import {useEffect, useRef, useState, type FormEvent} from 'react';
import {DataTableArrowPaginated} from '@sqlrooms/data-table';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@sqlrooms/ui';
import {useRoomStore} from './store';
import {
  commitDataImport,
  inferDataFileFormat,
  prepareDataImport,
  previewDataImport,
  suggestImportTableName,
  type DataFileFormat,
  type DataImportSource,
  type PreparedDataImport,
} from './dataImport';

/** Inspect a sample before importing a complete file, server path, or web URL. */
export function AddDataDialog({onClose}: {onClose: () => void}) {
  const tables = useRoomStore((s) => s.db.tables);
  const [kind, setKind] = useState<DataImportSource['kind']>('file');
  const [file, setFile] = useState<File>();
  const [locations, setLocations] = useState({url: '', path: ''});
  const [format, setFormat] = useState<DataFileFormat>('csv');
  const [customTableNames, setCustomTableNames] = useState<
    Partial<Record<DataImportSource['kind'], string>>
  >({});
  const [preview, setPreview] = useState<{
    source: PreparedDataImport;
    table: Awaited<ReturnType<typeof previewDataImport>>;
  }>();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const activeRequest = useRef<AbortController | undefined>(undefined);
  const committing = useRef(false);
  useEffect(() => () => activeRequest.current?.abort(), []);
  const location = kind === 'file' ? '' : locations[kind];
  const sourceName = kind === 'file' ? (file?.name ?? '') : location.trim();
  const setCustomTableName = (name: string | undefined) =>
    setCustomTableNames((names) => ({...names, [kind]: name}));
  const tableName =
    customTableNames[kind] ??
    (sourceName
      ? suggestImportTableName(
          sourceName,
          tables.map((table) => table.table.table),
        )
      : '');

  const invalidatePreview = () => {
    activeRequest.current?.abort();
    activeRequest.current = undefined;
    setPreview(undefined);
    setStatus('');
    setError('');
  };
  const loadPreview = async (source: DataImportSource) => {
    invalidatePreview();
    const request = new AbortController();
    activeRequest.current = request;
    setStatus(
      source.kind === 'file'
        ? 'Uploading and inspecting file…'
        : 'Inspecting data…',
    );
    try {
      const prepared = await prepareDataImport(source, request.signal);
      const table = await previewDataImport(prepared, request.signal);
      if (activeRequest.current === request)
        setPreview({source: prepared, table});
    } catch (e) {
      if (activeRequest.current === request && !request.signal.aborted)
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (activeRequest.current === request) {
        activeRequest.current = undefined;
        setStatus('');
      }
    }
  };
  const chooseFiles = (files: File[]) => {
    if (committing.current || !files.length) return;
    invalidatePreview();
    setFile(undefined);
    setCustomTableName(undefined);
    if (files.length !== 1) {
      setError(
        'Choose one file to preview at a time. Drop multiple files in the sidebar to add them immediately.',
      );
      return;
    }
    const next = files[0]!;
    if (!inferDataFileFormat(next.name)) {
      setError('Choose a CSV, Parquet, JSON, or JSONL file.');
      return;
    }
    setFile(next);
    void loadPreview({kind: 'file', file: next});
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (committing.current || status || !sourceName) return;
    if (!preview) {
      if (kind === 'file' && file) await loadPreview({kind, file});
      else if (kind === 'path') await loadPreview({kind, path: location});
      else if (kind === 'url') await loadPreview({kind, url: location, format});
      return;
    }
    if (!tableName.trim()) return;
    committing.current = true;
    setImporting(true);
    setStatus('Importing all rows…');
    setError('');
    try {
      await commitDataImport(preview.source, tableName.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      committing.current = false;
      setImporting(false);
      setStatus('');
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !committing.current) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!importing}
        className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden"
      >
        <DialogHeader>
          <DialogTitle>Add data</DialogTitle>
          <DialogDescription>
            Choose a file or web URL, inspect a sample, then add all rows to
            your database.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          <form
            id="roomie-add-data-form"
            onSubmit={(event) => void submit(event)}
            className="space-y-4"
            aria-busy={Boolean(status)}
          >
            <fieldset disabled={importing} className="space-y-4">
              <legend className="sr-only">Data source</legend>
              <Tabs
                value={kind}
                onValueChange={(value) => {
                  if (committing.current) return;
                  if (value !== 'file' && value !== 'url' && value !== 'path')
                    return;
                  invalidatePreview();
                  setKind(value);
                }}
              >
                <TabsList aria-label="Data source">
                  <TabsTrigger value="file" disabled={importing}>
                    File
                  </TabsTrigger>
                  <TabsTrigger value="url" disabled={importing}>
                    Web URL
                  </TabsTrigger>
                  <TabsTrigger value="path" disabled={importing}>
                    File path
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="file">
                  <div
                    className="bg-muted/30 space-y-2 rounded-lg border-2 border-dashed p-4"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      chooseFiles(Array.from(event.dataTransfer.files));
                    }}
                  >
                    <Label htmlFor="data-file">
                      Drop a file here or browse
                    </Label>
                    <Input
                      id="data-file"
                      type="file"
                      accept=".csv,.parquet,.json,.jsonl,.ndjson,.csv.gz,.json.gz,.csv.zst,.json.zst"
                      onChange={(event) => {
                        chooseFiles(Array.from(event.target.files ?? []));
                        event.target.value = '';
                      }}
                    />
                    {file && (
                      <p className="text-sm break-all">Selected: {file.name}</p>
                    )}
                  </div>
                </TabsContent>
                {(['url', 'path'] as const).map((sourceKind) => (
                  <TabsContent
                    key={sourceKind}
                    value={sourceKind}
                    className="space-y-2"
                  >
                    <Label htmlFor={`data-${sourceKind}`}>
                      {sourceKind === 'url' ? 'File URL' : 'File path'}
                    </Label>
                    <Input
                      id={`data-${sourceKind}`}
                      type={sourceKind === 'url' ? 'url' : 'text'}
                      value={locations[sourceKind]}
                      onChange={(event) => {
                        invalidatePreview();
                        setLocations((values) => ({
                          ...values,
                          [sourceKind]: event.target.value,
                        }));
                        setCustomTableName(undefined);
                        if (sourceKind === 'url') {
                          try {
                            setFormat(
                              inferDataFileFormat(event.target.value) ?? 'csv',
                            );
                          } catch {
                            setFormat('csv');
                          }
                        }
                      }}
                      placeholder={
                        sourceKind === 'url'
                          ? 'https://example.com/data.csv'
                          : '/path/to/data.csv'
                      }
                      required
                    />
                    {sourceKind === 'url' ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Label htmlFor="data-format">File format</Label>
                        <select
                          id="data-format"
                          className="rounded border p-2"
                          value={format}
                          onChange={(event) => {
                            invalidatePreview();
                            setFormat(event.target.value as DataFileFormat);
                          }}
                        >
                          <option value="csv">CSV</option>
                          <option value="parquet">Parquet</option>
                          <option value="json">JSON / JSONL</option>
                        </select>
                        <span className="text-muted-foreground text-xs">
                          Public HTTP or HTTPS file link
                        </span>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        A path on the machine running Roomie. You can use ~ for
                        your home directory.
                      </p>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
              <div className="space-y-2">
                <Label htmlFor="data-table-name">Table name</Label>
                <Input
                  id="data-table-name"
                  value={tableName}
                  onChange={(event) => setCustomTableName(event.target.value)}
                  placeholder="Filled automatically from the file name"
                  required={Boolean(preview)}
                />
                <p className="text-muted-foreground text-xs">
                  Creates a new table. Existing tables will not be replaced.
                </p>
              </div>
            </fieldset>
          </form>
          {preview && (
            <section aria-label="Data preview" className="space-y-2">
              <p className="text-muted-foreground text-xs">
                Preview · first {preview.table.numRows} rows (up to 100). Adding
                data imports the complete file.
              </p>
              <div className="h-64 overflow-hidden rounded border">
                <DataTableArrowPaginated
                  table={preview.table}
                  pageSize={10}
                  className="h-full"
                />
              </div>
            </section>
          )}
          {error && (
            <p
              role="alert"
              className="text-destructive text-sm whitespace-pre-wrap"
            >
              {error}
            </p>
          )}
          <p role="status" className="text-muted-foreground text-sm">
            {status}
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={importing}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="roomie-add-data-form"
            disabled={
              Boolean(status) ||
              !sourceName ||
              (Boolean(preview) && !tableName.trim())
            }
          >
            {importing
              ? 'Adding data…'
              : status
                ? 'Loading preview…'
                : preview
                  ? 'Add data'
                  : 'Preview data'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
