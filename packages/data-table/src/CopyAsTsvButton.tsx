import {useCopyAsTsv} from '@sqlrooms/duckdb';
import {Button, toast} from '@sqlrooms/ui';
import {ClipboardIcon} from 'lucide-react';
import {FC, useState} from 'react';

export const CopyAsTsvButton: FC<{query: string}> = ({query}) => {
  const {copyAsTsv} = useCopyAsTsv();
  const [isCopying, setIsCopying] = useState(false);

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
    <Button
      variant="ghost"
      size="xs"
      disabled={isCopying}
      className="h-7 w-7"
      title="Copy results to clipboard"
      onClick={handleCopy}
    >
      {isCopying ? (
        <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
      ) : (
        <ClipboardIcon size={16} />
      )}
    </Button>
  );
};
