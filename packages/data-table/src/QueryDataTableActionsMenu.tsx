import {useExportToCsv} from '@sqlrooms/duckdb';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  Button,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@sqlrooms/ui';
import {formatTimestampForFilename} from '@sqlrooms/utils';
import {DownloadIcon} from 'lucide-react';
import {FC, useState} from 'react';

const makeExportFilename = (extension: string) => {
  return `export-${formatTimestampForFilename()}.${extension}`;
};

export const QueryDataTableActionsMenu: FC<{
  query: string;
}> = ({query}) => {
  const {exportToCsv} = useExportToCsv();
  const [isExporting, setIsExporting] = useState(false);
  const handleExport = async () => {
    if (!query) return;
    try {
      setIsExporting(true);
      await exportToCsv(query, makeExportFilename('csv'));
    } finally {
      setIsExporting(false);
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="xs" disabled={isExporting}>
          {isExporting ? (
            <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
          ) : (
            <DownloadIcon className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExport}>Export CSV</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
