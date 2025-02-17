import {QueryDataTable} from '@sqlrooms/data-table';
import {escapeVal, getDuckTables} from '@sqlrooms/duckdb';
import {
  EditableText,
  SpinnerPane,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@sqlrooms/ui';
import {
  Dispatch,
  FC,
  SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react';

import {ProjectFileInfo} from '@sqlrooms/project-builder';
import {
  convertToUniqueColumnOrTableName,
  convertToUniqueS3ObjectName,
  splitFilePath,
} from '@sqlrooms/utils';
import {produce} from 'immer';
import {useProjectStore} from '../../../store';

const DEFAULT_TABLE_NAME = 'unnamed_table';
const DEFAULT_FILE_NAME = 'unnamed_file';

type Props = {
  addedFiles: ProjectFileInfo[];
  tableNames?: string[];
  onSetTableNames: Dispatch<SetStateAction<string[] | undefined>>;
  onSetAddedFiles: Dispatch<SetStateAction<ProjectFileInfo[] | undefined>>;
};

// const Warning: FC<{text: string} & IconProps> = ({text, ...rest}) => (
//   <Tooltip hasArrow placement="right" label={text} backgroundColor="error">
//     <Icon
//       as={WarningTwoIcon}
//       w={4}
//       h={4}
//       color={'error'}
//       cursor="pointer"
//       {...rest}
//     />
//   </Tooltip>
// );

const UploadFilesPreview: FC<Props> = (props) => {
  const {addedFiles, tableNames, onSetAddedFiles, onSetTableNames} = props;
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [existingTables, setExistingTables] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const ErrorBoundary = useProjectStore(
    (state) => state.project.CustomErrorBoundary,
  );

  useEffect(() => {
    setSelectedFileIndex(0);
  }, []);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const tables = await getDuckTables();
        setExistingTables(tables);
      } catch (error) {
        console.error('Failed to fetch DuckDB tables:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTables();
  }, []);

  const handleSetTableName = useCallback(
    (i: number, name: string) => {
      const nextName = convertToUniqueColumnOrTableName(
        name.trim() || DEFAULT_TABLE_NAME,
        existingTables,
      );
      onSetTableNames(
        produce((draft) => {
          if (!draft) draft = [];
          draft[i] = nextName;
          return draft;
        }),
      );
      return nextName;
    },
    [existingTables, onSetTableNames],
  );

  const handleSetFileName = useCallback(
    (i: number, name: string) => {
      const nextName = convertToUniqueS3ObjectName(
        name.trim() || DEFAULT_FILE_NAME,
        [],
      );
      onSetAddedFiles(
        produce((draft) => {
          const fileInfo = draft?.[i];
          if (fileInfo) {
            fileInfo.pathname = nextName;
          }
          return draft;
        }),
      );
      return nextName;
    },
    [onSetAddedFiles],
  );

  return isLoading ? (
    <SpinnerPane />
  ) : (
    <div className="flex flex-col gap-3 h-full text-sm">
      <Tabs
        value={selectedFileIndex.toString()}
        onValueChange={(value) => setSelectedFileIndex(parseInt(value))}
        className="flex-grow flex flex-col w-full h-full overflow-hidden"
      >
        <TabsList className="h-10">
          {addedFiles.map(({pathname}, i) => (
            <TabsTrigger
              key={i}
              value={i.toString()}
              className="max-w-[250px] truncate"
            >
              {splitFilePath(pathname).name}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="flex w-full h-full overflow-hidden">
          {addedFiles.map(({pathname}, i) => (
            <TabsContent
              key={pathname}
              value={i.toString()}
              className="flex-grow flex flex-col overflow-hidden m-0 border-none"
            >
              <div className="flex flex-col gap-3 overflow-auto flex-grow">
                <div className="grid grid-cols-[1fr,auto] gap-1 items-center self-start justify-items-start pt-4 text-sm">
                  <span className="text-muted-foreground whitespace-nowrap">
                    File path:
                  </span>
                  <div className="flex items-center px-2">
                    <EditableText
                      value={addedFiles[i]?.pathname ?? ''}
                      onChange={(name) => handleSetFileName(i, name)}
                    />
                  </div>
                  <span className="text-muted-foreground whitespace-nowrap">
                    Table name:
                  </span>
                  <EditableText
                    className="w-[400px]"
                    value={tableNames?.[i] ?? ''}
                    onChange={(name) => handleSetTableName(i, name)}
                  />
                </div>
                <div className="flex-grow overflow-hidden">
                  <ErrorBoundary>
                    <QueryDataTable
                      query={`SELECT * FROM ${escapeVal(
                        addedFiles[selectedFileIndex]?.duckdbFileName ?? '',
                      )}`}
                    />
                  </ErrorBoundary>
                </div>
              </div>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
};

export default UploadFilesPreview;
