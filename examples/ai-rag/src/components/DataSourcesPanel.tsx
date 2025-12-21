import {RoomPanel} from '@sqlrooms/room-shell';
import {TableStructurePanel} from '@sqlrooms/sql-editor';
import {FileDropzone} from '@sqlrooms/dropzone';
import {useRoomStore, RoomPanelTypes} from '../store';
import {convertToValidColumnOrTableName} from '@sqlrooms/utils';
import {useToast, Tabs, TabsContent, TabsList, TabsTrigger} from '@sqlrooms/ui';
import {useState, useEffect, useCallback} from 'react';
import {FileTextIcon} from 'lucide-react';

type RagDoc = {fileName: string; docId: string};

export const DataSourcesPanel = () => {
  const connector = useRoomStore((state) => state.db.connector);
  const refreshTableSchemas = useRoomStore(
    (state) => state.db.refreshTableSchemas,
  );
  const addDocument = useRoomStore((state) => state.rag.addDocument);
  const addPdfDocument = useRoomStore((state) => state.rag.addPdfDocument);
  const {toast} = useToast();
  const [loading, setLoading] = useState(false);
  const [ragDocs, setRagDocs] = useState<RagDoc[]>([]);

  const refreshRagDocs = useCallback(async () => {
    try {
      const result = await connector.query(
        `SELECT doc_id, file_name FROM user_docs.source_documents ORDER BY created_at DESC`,
      );
      const rows = result.toArray();
      setRagDocs(
        rows.map((r: any) => ({
          docId: r.doc_id,
          fileName: r.file_name || 'Untitled',
        })),
      );
    } catch {
      // Table may not exist yet
    }
  }, [connector]);

  useEffect(() => {
    refreshRagDocs();
  }, [refreshRagDocs]);

  const handleRagUpload = async (files: File[]) => {
    setLoading(true);
    for (const file of files) {
      try {
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        if (isPdf) {
          await addPdfDocument(file);
        } else {
          const text = await file.text();
          await addDocument({text, fileName: file.name});
        }
        toast({
          title: 'Document added',
          description: `${file.name} added to RAG database`,
        });
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: `Failed to add ${file.name}: ${error}`,
        });
      }
    }
    setLoading(false);
    await refreshRagDocs();
  };

  return (
    <RoomPanel type={RoomPanelTypes.enum['data-sources']}>
      <Tabs defaultValue="data" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="data" className="flex-1">
            Data
          </TabsTrigger>
          <TabsTrigger value="docs" className="flex-1">
            Docs
          </TabsTrigger>
        </TabsList>
        <TabsContent value="data">
          <FileDropzone
            className="h-[150px] p-5"
            acceptedFormats={{
              'text/csv': ['.csv'],
              'text/tsv': ['.tsv'],
              'text/parquet': ['.parquet'],
              'text/json': ['.json'],
            }}
            onDrop={async (files) => {
              for (const file of files) {
                try {
                  const tableName = convertToValidColumnOrTableName(file.name);
                  await connector.loadFile(file, tableName);
                  toast({
                    title: 'Table created',
                    description: `${file.name} loaded as ${tableName}`,
                  });
                } catch (error) {
                  toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: `Error loading ${file.name}: ${error}`,
                  });
                }
              }
              await refreshTableSchemas();
            }}
          >
            <div className="text-muted-foreground text-xs">
              CSV, TSV, Parquet, JSON
            </div>
          </FileDropzone>
        </TabsContent>
        <TabsContent value="docs">
          <FileDropzone
            className="h-[100px] p-4"
            acceptedFormats={{
              'application/pdf': ['.pdf'],
              'text/markdown': ['.md'],
              'text/plain': ['.txt'],
            }}
            onDrop={handleRagUpload}
          >
            <div className="text-muted-foreground text-xs">
              {loading ? 'Processing...' : 'PDF, MD, TXT for RAG'}
            </div>
          </FileDropzone>
          {ragDocs.length > 0 && (
            <div className="mt-2 space-y-1 px-2">
              <div className="text-muted-foreground mb-1 text-xs">
                Documents ({ragDocs.length})
              </div>
              {ragDocs.map((doc) => (
                <div
                  key={doc.docId}
                  className="flex items-center gap-2 truncate text-sm"
                >
                  <FileTextIcon className="text-muted-foreground h-3 w-3 shrink-0" />
                  <span className="truncate">{doc.fileName}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      <TableStructurePanel />
    </RoomPanel>
  );
};
