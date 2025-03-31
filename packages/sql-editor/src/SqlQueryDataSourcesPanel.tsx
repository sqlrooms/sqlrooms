import {
  DataSourceStatus,
  useBaseProjectBuilderStore,
} from '@sqlrooms/project-builder';
import {SqlQueryDataSource} from '@sqlrooms/project-builder';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sqlrooms/ui';
import {
  EllipsisIcon,
  FileIcon,
  PencilIcon,
  PlusIcon,
  RefreshCcwIcon,
  XIcon,
} from 'lucide-react';
import {FC, useCallback, useState} from 'react';
import CreateTableModal from './CreateTableModal';

const SqlQueryDataSourcesPanel: FC<{
  isReadOnly?: boolean;
  queryDataSources: SqlQueryDataSource[];
}> = ({queryDataSources, isReadOnly}) => {
  const [selectedDataSource, setSelectedDataSource] =
    useState<SqlQueryDataSource>();
  const [isOpen, setIsOpen] = useState(false);
  const dataSourceStates = useBaseProjectBuilderStore(
    (state) => state.project.dataSourceStates,
  );
  const removeSqlQueryDataSource = useBaseProjectBuilderStore(
    (state) => state.project.removeSqlQueryDataSource,
  );

  const handleEdit = useCallback((dataSource: SqlQueryDataSource) => {
    setSelectedDataSource(dataSource);
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSelectedDataSource(undefined);
  }, []);

  const handleRemove = useCallback(
    (dataSource: SqlQueryDataSource) => {
      const {tableName} = dataSource;
      removeSqlQueryDataSource(tableName);
    },
    [removeSqlQueryDataSource],
  );

  const addOrUpdateSqlQueryDataSource = useBaseProjectBuilderStore(
    (state) => state.project.addOrUpdateSqlQueryDataSource,
  );

  return (
    <div className="flex flex-grow flex-col overflow-auto">
      <div className="flex flex-col items-stretch">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsOpen(true)}
          disabled={isReadOnly}
        >
          <PlusIcon className="mr-2 h-4 w-4" />
          Add
        </Button>
      </div>
      <CreateTableModal
        isOpen={isOpen}
        onClose={handleClose}
        editDataSource={selectedDataSource}
        query=""
        onAddOrUpdateSqlQuery={addOrUpdateSqlQueryDataSource}
      />

      <div className="flex flex-grow flex-col overflow-auto">
        {queryDataSources.map((dataSource) => (
          <div key={dataSource.tableName} className="flex flex-col gap-1 p-2">
            <div className="flex cursor-pointer flex-row items-center gap-1">
              <div className="w-[15px] flex-none">
                <FileIcon className="w-[15px]" />
              </div>
              <div className="flex-1 overflow-hidden text-ellipsis">
                <span className="break-words text-xs">
                  {dataSource.tableName}
                </span>
              </div>
              <div className="flex-none">
                {!isReadOnly ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground h-6 w-6"
                      >
                        <EllipsisIcon className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(dataSource)}>
                        <PencilIcon className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled>
                        <RefreshCcwIcon className="mr-2 h-4 w-4" />
                        Refresh
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleRemove(dataSource)}
                      >
                        <XIcon className="mr-2 h-4 w-4" />
                        Remove from project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            </div>
            <div className="flex flex-row items-center gap-1">
              {dataSourceStates[dataSource.tableName]?.status ===
              DataSourceStatus.ERROR ? (
                <div className="bg-destructive/15 text-destructive flex-1 rounded p-1 text-xs">
                  {dataSourceStates[dataSource.tableName]?.message}
                </div>
              ) : dataSourceStates[dataSource.tableName]?.status ===
                DataSourceStatus.FETCHING ? (
                <div className="bg-secondary h-1 w-full overflow-hidden rounded">
                  <div className="bg-primary h-full animate-pulse" />
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export {SqlQueryDataSourcesPanel};
