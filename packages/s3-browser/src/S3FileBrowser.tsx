import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
  Button,
  Checkbox,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from '@sqlrooms/ui';
import {S3FileOrDirectory} from '@sqlrooms/s3-browser-config';
import {Undo2Icon, FolderIcon, Search} from 'lucide-react';
import {formatBytes, formatTimeRelative} from '@sqlrooms/utils';
import {FC, useCallback, useEffect, useMemo, useState} from 'react';

function renderFileName(
  key: string,
  searchQuery: string,
  isDirectory: boolean,
) {
  return (
    <>
      {searchQuery ? (
        <span
          dangerouslySetInnerHTML={{
            __html:
              key.replace(
                new RegExp(`(${searchQuery})`, 'gi'),
                '<mark class="bg-yellow-200">$1</mark>',
              ) + (isDirectory ? '/' : ''),
          }}
        />
      ) : (
        <span>
          {key}
          {isDirectory ? '/' : ''}
        </span>
      )}
    </>
  );
}
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
  renderFileActions?: () => React.ReactNode;
}> = (props) => {
  const {
    files,
    selectedDirectory,
    selectedFiles,
    onCanConfirmChange,
    onChangeSelectedFiles,
    onChangeSelectedDirectory,
    renderFileActions,
  } = props;

  useEffect(() => {
    onCanConfirmChange(Boolean(selectedFiles?.length));
  }, [selectedFiles, onCanConfirmChange]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim() || !files) {
      return files;
    }

    return files.filter((file) =>
      file.key.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [files, searchQuery]);

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
  const handleSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchQuery(value);
      if (value.trim() === '') {
        onChangeSelectedFiles([]);
      }
    },
    [onChangeSelectedFiles, setSearchQuery],
  );
  const parentDirectory = useMemo(() => {
    const dir = selectedDirectory.split('/').slice(0, -2).join('/');
    return dir ? `${dir}/` : '';
  }, [selectedDirectory]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Search Box */}
      <div className="flex w-full justify-end px-[1px] py-2">
        {renderFileActions ? renderFileActions() : null}
        <div className="relative w-[240px] shrink-0">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <Input
            type="text"
            placeholder="Search files by name"
            value={searchQuery}
            onChange={handleSearchInputChange}
            className="h-8 py-2 pl-10 text-xs leading-5 md:text-xs"
          />
        </div>
      </div>
      <div className="absolute flex h-full w-full flex-col items-start overflow-x-auto overflow-y-auto py-0">
        <div className="border-border w-full overflow-y-auto rounded-lg border">
          <Table disableWrapper>
            <TableHeader>
              {selectedDirectory ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="bg-secondary text-secondary-foreground"
                  >
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onChangeSelectedDirectory(parentDirectory)
                        }
                      >
                        <Undo2Icon className="mr-1 h-3 w-3" />
                        ..
                      </Button>
                      <Breadcrumb>
                        <BreadcrumbList>
                          <BreadcrumbItem>
                            <BreadcrumbLink
                              onClick={() => onChangeSelectedDirectory('')}
                              className="text-primary text-xs"
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
                                    'text-primary text-xs',
                                    isCurrent
                                      ? 'cursor-default hover:no-underline'
                                      : 'cursor-pointer',
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
              <TableRow className="bg-accent text-primary-foreground sticky top-0 z-[2]">
                <TableHead className="w-[1%]">
                  <Checkbox
                    checked={selectedFiles.length === filesInDirectory.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="text-foreground py-2">Name</TableHead>
                <TableHead className="text-foreground py-2">Type</TableHead>
                <TableHead className="text-foreground text-right">
                  Size
                </TableHead>
                <TableHead className="text-foreground text-right">
                  Modified
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFiles?.map((object) => {
                const {key, isDirectory} = object;
                return (
                  <TableRow
                    key={key}
                    className="text-foreground hover:bg-accent cursor-pointer"
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
                          <FolderIcon className="h-4 w-4" />
                          {renderFileName(key, searchQuery, true)}
                        </div>
                      ) : (
                        renderFileName(key, searchQuery, false)
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {isDirectory ? 'Directory' : object.contentType}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {!isDirectory && object.size !== undefined
                        ? formatBytes(object.size)
                        : ''}
                    </TableCell>
                    <TableCell className="text-right text-xs">
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
