import {useExportToCsv, useCopyAsTsv} from '@sqlrooms/duckdb';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  Button,
  DropdownMenuContent,
  DropdownMenuItem,
  toast,
} from '@sqlrooms/ui';
import {formatTimestampForFilename} from '@sqlrooms/utils';
import {ClipboardIcon, DownloadIcon} from 'lucide-react';
import {FC, useState} from 'react';

const makeExportFilename = (extension: string) => {
  return `export-${formatTimestampForFilename()}.${extension}`;
};

export const QueryDataTableActionsMenu: FC<{
  query: string;
}> = ({query}) => {
  const {exportToCsv} = useExportToCsv();
  const {copyAsTsv} = useCopyAsTsv();
  const [isExporting, setIsExporting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const handleExport = async () => {
    if (!query) return;
    try {
      setIsExporting(true);
      await exportToCsv(query, makeExportFilename('csv'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopy = async () => {
    if (!query) return;
    try {
      setIsCopying(true);
      const rowCount = await copyAsTsv(query);
      toast.success(
        rowCount === 1 ? 'Copied 1 row' : `Copied ${rowCount} rows`,
      );
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="xs"
        disabled={isCopying}
        className="h-7 w-7"
        title="Copy as TSV"
        onClick={handleCopy}
      >
        {isCopying ? (
          <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
        ) : (
          <ClipboardIcon size={16} />
        )}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="xs"
            disabled={isExporting}
            className="h-7 w-7"
          >
            {isExporting ? (
              <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
            ) : (
              <DownloadIcon size={16} />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExport}>Export CSV</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
