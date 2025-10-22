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
import {useBaseRoomShellStore} from '../RoomShellStore';
import {RoomFileInfo, RoomFileState} from '../types';
const FileDataSourceCard: FC<{
  isReadOnly?: boolean;
  fileInfo: RoomFileInfo;
  fileState?: RoomFileState;
}> = (props) => {
  const {isReadOnly, fileInfo, fileState} = props;
  const {pathname, size} = fileInfo;
  const {filename} = splitFilePath(pathname);
  const removeRoomFile = useBaseRoomShellStore(
    (state) => state.room.removeRoomFile,
  );
  const handleRemoveFromRoom = useCallback(() => {
    removeRoomFile(fileInfo.pathname);
  }, [fileInfo.pathname, removeRoomFile]);

  return (
    <div className="flex flex-col gap-1 p-2">
      <div className="flex cursor-pointer flex-row items-center gap-1">
        <div className="w-[15px] flex-none">
          <FileTextIcon className="w-[15px]" />
        </div>
        <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="break-words text-xs">{filename}</span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <pre className="w-[300px] text-wrap break-words text-xs">
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
                  className="text-muted-foreground h-6 w-6"
                >
                  <EllipsisIcon className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleRemoveFromRoom}>
                  <XIcon className="mr-2 h-4 w-4" />
                  Remove file
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
      <div className="flex flex-row items-center gap-1">
        {fileState?.status === 'error' ? (
          <div className="bg-destructive/15 text-destructive flex-1 rounded p-1 text-xs">
            {fileState.message}
          </div>
        ) : fileState?.status === 'download' ||
          fileState?.status === 'upload' ? (
          <div className="bg-secondary h-1 w-full overflow-hidden rounded">
            <div
              className="bg-primary h-full transition-all duration-300"
              style={{
                width: `${(fileState.progress?.ratio ?? 0) * 100}%`,
              }}
            />
          </div>
        ) : null}
        <div className="flex-none">
          {size !== undefined ? (
            <span className="text-muted-foreground min-w-[70px] text-right text-xs">
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
            <CloudIcon className="text-destructive w-[15px]" />
          ) : (
            <CloudIcon className="w-[15px] text-orange-400" />
          )}
        </div>
      </div>
    </div>
  );
};

export {FileDataSourceCard};
