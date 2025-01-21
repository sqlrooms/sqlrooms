import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sqlrooms/ui';
import {
  EllipsisHorizontalIcon,
  PencilIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';
import {SqlQueryDataSource} from '@sqlrooms/project-config';
import {CreateTableModal} from '@sqlrooms/sql-editor';
import {FC, useCallback, useState} from 'react';
import {FiRefreshCw} from 'react-icons/fi';
import {PiFileSql} from 'react-icons/pi';
import {useBaseProjectStore} from '../../ProjectStateProvider';
import {DataSourceStatus} from '../../types';

type Props = {
  queryDataSources: SqlQueryDataSource[];
};

const SqlQueryDataSourcesPanel: FC<Props> = (props) => {
  const {queryDataSources} = props;
  const [selectedDataSource, setSelectedDataSource] =
    useState<SqlQueryDataSource>();
  const [isOpen, setIsOpen] = useState(false);
  const dataSourceStates = useBaseProjectStore(
    (state) => state.dataSourceStates,
  );
  const removeSqlQueryDataSource = useBaseProjectStore(
    (state) => state.removeSqlQueryDataSource,
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

  const addOrUpdateSqlQuery = useBaseProjectStore(
    (state) => state.addOrUpdateSqlQuery,
  );

  const isReadOnly = useBaseProjectStore((state) => state.isReadOnly);

  return (
    <div className="flex flex-col overflow-auto flex-grow">
      <div className="flex flex-col items-stretch">
        <Button
          variant="secondary"
          size="sm"
          className="text-white"
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
        onAddOrUpdateSqlQuery={addOrUpdateSqlQuery}
      />

      <div className="flex flex-col overflow-auto flex-grow">
        {queryDataSources.map((dataSource) => (
          <div key={dataSource.tableName} className="p-2 flex flex-col gap-1">
            <div className="flex gap-1 cursor-pointer flex-row items-center">
              <div className="flex-none w-[15px]">
                <PiFileSql className="w-[15px]" />
              </div>
              <div className="flex-1 overflow-hidden text-ellipsis">
                <span className="text-xs break-words">
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
                        className="h-6 w-6 text-muted-foreground"
                      >
                        <EllipsisHorizontalIcon className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(dataSource)}>
                        <PencilIcon className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled>
                        <FiRefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleRemove(dataSource)}
                      >
                        <XMarkIcon className="mr-2 h-4 w-4" />
                        Remove from project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            </div>
            <div className="flex flex-row gap-1 items-center">
              {dataSourceStates[dataSource.tableName]?.status ===
              DataSourceStatus.ERROR ? (
                <div className="flex-1 bg-destructive/15 text-destructive text-xs p-1 rounded">
                  {dataSourceStates[dataSource.tableName]?.message}
                </div>
              ) : dataSourceStates[dataSource.tableName]?.status ===
                DataSourceStatus.FETCHING ? (
                <div className="w-full bg-secondary h-1 rounded overflow-hidden">
                  <div className="h-full bg-primary animate-pulse" />
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SqlQueryDataSourcesPanel;
