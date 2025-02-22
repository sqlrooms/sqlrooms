import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {formatBytes, splitFilePath} from '@sqlrooms/utils';
import {
  CloudDownloadIcon,
  CloudIcon,
  CloudUploadIcon,
  EllipsisIcon,
  FileDownIcon,
  FileTextIcon,
  XIcon,
} from 'lucide-react';
import {FC, useCallback} from 'react';
import {useBaseProjectStore} from '../ProjectStateProvider';
import {ProjectFileInfo, ProjectFileState} from '../types';

const FileDataSourceCard: FC<{
  isReadOnly?: boolean;
  fileInfo: ProjectFileInfo;
  fileState?: ProjectFileState;
}> = (props) => {
  const {isReadOnly, fileInfo, fileState} = props;
  const {pathname, size} = fileInfo;
  const {filename} = splitFilePath(pathname);
  const removeProjectFile = useBaseProjectStore(
    (state) => state.project.removeProjectFile,
  );
  const handleRemoveFromProject = useCallback(() => {
    removeProjectFile(fileInfo.pathname);
  }, [fileInfo.pathname, removeProjectFile]);

  return (
    <div className="p-2 flex flex-col gap-1">
      <div className="flex gap-1 cursor-pointer flex-row items-center">
        <div className="flex-none w-[15px]">
          <FileTextIcon className="w-[15px]" />
        </div>
        <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs break-words">{filename}</span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <pre className="text-xs break-words w-[300px] text-wrap">
                {pathname}
              </pre>
            </TooltipContent>
          </Tooltip>
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
                  <EllipsisIcon className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleRemoveFromProject}>
                  <XIcon className="mr-2 h-4 w-4" />
                  Remove from project
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <FileDownIcon className="mr-2 h-4 w-4" />
                  Download file
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
      <div className="flex flex-row gap-1 items-center">
        {fileState?.status === 'error' ? (
          <div className="flex-1 bg-destructive/15 text-destructive text-xs p-1 rounded">
            {fileState.message}
          </div>
        ) : fileState?.status === 'download' ||
          fileState?.status === 'upload' ? (
          <div className="w-full bg-secondary h-1 rounded overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${(fileState.progress?.ratio ?? 0) * 100}%`,
              }}
            />
          </div>
        ) : null}
        <div className="flex-none">
          {size !== undefined ? (
            <span className="text-xs text-muted-foreground min-w-[70px] text-right">
              {formatBytes(size)}
            </span>
          ) : null}
        </div>
        <div
          className="cursor-pointer"
          title={
            fileState?.status === 'done'
              ? 'File synced'
              : fileState?.status === 'download'
                ? 'Downloading file…'
                : fileState?.status === 'upload'
                  ? 'Uploading file…'
                  : fileState?.status === 'error'
                    ? `Failed to sync file: ${fileState.message}`
                    : 'File not synced'
          }
        >
          {fileState?.status === 'done' ? (
            <CloudIcon className="w-[15px] text-green-400" />
          ) : fileState?.status === 'download' ? (
            <CloudDownloadIcon className="w-[15px] text-orange-400" />
          ) : fileState?.status === 'upload' ? (
            <CloudUploadIcon className="w-[15px] text-orange-400" />
          ) : fileState?.status === 'error' ? (
            <CloudIcon className="w-[15px] text-destructive" />
          ) : (
            <CloudIcon className="w-[15px] text-orange-400" />
          )}
        </div>
      </div>
    </div>
  );
};

export {FileDataSourceCard};
