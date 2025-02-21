import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
  Button,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from '@sqlrooms/ui';
import {Undo2Icon, FolderIcon} from 'lucide-react';
import {formatBytes, formatTimeRelative} from '@sqlrooms/utils';
import {FC, useCallback, useEffect, useMemo} from 'react';
import {S3FileOrDirectory} from './S3FileOrDirectory';

/**
 * A file browser component for navigating and selecting files from an S3-like storage.
 *
 * This component provides a familiar file explorer interface with features like:
 * - Directory navigation with breadcrumbs
 * - File and directory listing
 * - Multiple file selection
 * - File metadata display (size, type, last modified)
 *
 * ![S3 File Browser Interface](https://github.com/user-attachments/assets/dd79fbb9-c487-4050-96ef-81cff39930d3)
 *
 * @example
 * ```tsx
 * const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
 * const [selectedDirectory, setSelectedDirectory] = useState('');
 *
 * return (
 *   <S3FileBrowser
 *     files={[
 *       { key: 'documents', isDirectory: true },
 *       {
 *         key: 'example.txt',
 *         isDirectory: false,
 *         size: 1024,
 *         contentType: 'text/plain',
 *         lastModified: new Date()
 *       }
 *     ]}
 *     selectedFiles={selectedFiles}
 *     selectedDirectory={selectedDirectory}
 *     onCanConfirmChange={(canConfirm) => console.log('Can confirm:', canConfirm)}
 *     onChangeSelectedDirectory={setSelectedDirectory}
 *     onChangeSelectedFiles={setSelectedFiles}
 *   />
 * );
 * ```
 *
 * @param props - The component props
 * @param props.files - Array of files and directories to display
 * @param props.selectedFiles - Array of currently selected file keys
 * @param props.selectedDirectory - Current directory path (empty string for root)
 * @param props.onCanConfirmChange - Callback fired when selection state changes
 * @param props.onChangeSelectedDirectory - Callback fired when directory navigation occurs
 * @param props.onChangeSelectedFiles - Callback fired when file selection changes
 */
const S3FileBrowser: FC<{
  files?: S3FileOrDirectory[];
  selectedFiles: string[];
  selectedDirectory: string;
  onCanConfirmChange: (canConfirm: boolean) => void;
  onChangeSelectedDirectory: (directory: string) => void;
  onChangeSelectedFiles: (files: string[]) => void;
}> = (props) => {
  const {
    files,
    selectedDirectory,
    selectedFiles,
    onCanConfirmChange,
    onChangeSelectedFiles,
    onChangeSelectedDirectory,
  } = props;

  useEffect(() => {
    onCanConfirmChange(Boolean(selectedFiles?.length));
  }, [selectedFiles, onCanConfirmChange]);

  const handleSelectFile = useCallback(
    (key: string) => {
      if (selectedFiles.includes(key)) {
        onChangeSelectedFiles(selectedFiles.filter((id) => id !== key));
      } else {
        onChangeSelectedFiles([...selectedFiles, key]);
      }
    },
    [onChangeSelectedFiles, selectedFiles],
  );

  const handleSelectDirectory = useCallback(
    (key: string) => {
      onChangeSelectedDirectory(`${selectedDirectory}${key}/`);
    },
    [selectedDirectory, onChangeSelectedDirectory],
  );

  const filesInDirectory = useMemo(
    () => files?.filter(({isDirectory}) => !isDirectory) ?? [],
    [files],
  );

  const handleSelectAll = useCallback(() => {
    if (selectedFiles.length === filesInDirectory.length) {
      onChangeSelectedFiles([]);
    } else {
      onChangeSelectedFiles(filesInDirectory.map(({key}) => key) ?? []);
    }
  }, [filesInDirectory, onChangeSelectedFiles, selectedFiles.length]);

  const parentDirectory = useMemo(() => {
    const dir = selectedDirectory.split('/').slice(0, -2).join('/');
    return dir ? `${dir}/` : '';
  }, [selectedDirectory]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div className="absolute w-full h-full overflow-x-auto overflow-y-auto flex flex-col py-0 items-start">
        <div className="w-full rounded-lg border border-gray-600 overflow-y-auto">
          <Table disableWrapper>
            <TableHeader>
              {selectedDirectory ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-3 text-gray-100 bg-gray-800"
                  >
                    <div className="flex gap-2 items-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onChangeSelectedDirectory(parentDirectory)
                        }
                      >
                        <Undo2Icon className="w-3 h-3 mr-1" />
                        ..
                      </Button>
                      <Breadcrumb>
                        <BreadcrumbList>
                          <BreadcrumbItem>
                            <BreadcrumbLink
                              onClick={() => onChangeSelectedDirectory('')}
                              className="text-xs text-blue-400"
                            >
                              Home
                            </BreadcrumbLink>
                          </BreadcrumbItem>

                          {selectedDirectory.split('/').map((directory, i) => {
                            if (!directory) return null;
                            const path = selectedDirectory
                              .split('/')
                              .slice(0, i + 1)
                              .join('/')
                              .concat('/');
                            const isCurrent = path === selectedDirectory;
                            return (
                              <BreadcrumbItem key={i}>
                                <BreadcrumbSeparator />
                                <BreadcrumbLink
                                  className={cn(
                                    'text-xs text-blue-400',
                                    isCurrent &&
                                      'cursor-default hover:no-underline',
                                  )}
                                  onClick={() => {
                                    if (!isCurrent) {
                                      onChangeSelectedDirectory(path);
                                    }
                                  }}
                                >
                                  {directory}
                                </BreadcrumbLink>
                              </BreadcrumbItem>
                            );
                          })}
                        </BreadcrumbList>
                      </Breadcrumb>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
              <TableRow className="sticky top-0 z-[2] bg-gray-600">
                <TableHead className="w-[1%]">
                  <Checkbox
                    checked={selectedFiles.length === filesInDirectory.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="py-2 text-foreground">Name</TableHead>
                <TableHead className="py-2 text-foreground">Type</TableHead>
                <TableHead className="text-foreground text-right">
                  Size
                </TableHead>
                <TableHead className="text-foreground text-right">
                  Modified
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files?.map((object) => {
                const {key, isDirectory} = object;
                return (
                  <TableRow
                    key={key}
                    className="cursor-pointer text-blue-300 hover:bg-blue-700 hover:text-foreground"
                    onClick={(evt) => {
                      if (isDirectory) {
                        handleSelectDirectory(key);
                      } else {
                        handleSelectFile(key);
                        evt.preventDefault(); // prevent double change when clicking checkbox
                      }
                    }}
                  >
                    <TableCell>
                      <Checkbox
                        disabled={isDirectory}
                        checked={selectedFiles.includes(key)}
                      />
                    </TableCell>
                    <TableCell className="text-xs">
                      {isDirectory ? (
                        <div className="flex items-center gap-2">
                          <FolderIcon className="w-4 h-4" />
                          <span>{`${key}/`}</span>
                        </div>
                      ) : (
                        key
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {isDirectory ? 'Directory' : object.contentType}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {!isDirectory && object.size !== undefined
                        ? formatBytes(object.size)
                        : ''}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {!isDirectory && object.lastModified
                        ? formatTimeRelative(object.lastModified)
                        : ''}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default S3FileBrowser;
