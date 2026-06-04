import {FileDropzone} from '@sqlrooms/dropzone';
import {SchemaExplorer} from '@sqlrooms/sql-editor';
import {DbConnectionsSection} from './DbConnectionsSection';
import {
  LOCAL_DATA_ACCEPTED_FORMATS,
  useLocalFileLoader,
} from './useLocalFileLoader';

export const DataSourcesPanel = () => {
  const loadLocalFiles = useLocalFileLoader();

  return (
    <div className="flex h-full flex-col p-2">
      <FileDropzone
        className="h-50 p-5"
        acceptedFormats={LOCAL_DATA_ACCEPTED_FORMATS}
        onDrop={loadLocalFiles}
      >
        <div className="text-muted-foreground text-xs">
          Files stay on your machine and are loaded into DuckDB locally.
        </div>
      </FileDropzone>

      <SchemaExplorer>
        <SchemaExplorer.Header>
          <SchemaExplorer.RefreshButton />
        </SchemaExplorer.Header>
        <SchemaExplorer.Tree className="h-full" />
      </SchemaExplorer>

      <DbConnectionsSection />
    </div>
  );
};
