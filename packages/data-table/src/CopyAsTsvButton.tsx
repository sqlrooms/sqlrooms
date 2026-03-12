import {useCopyAsTsv} from '@sqlrooms/duckdb';
import {Button, Spinner, toast} from '@sqlrooms/ui';
import {ClipboardIcon} from 'lucide-react';
import {FC, useState} from 'react';

export const CopyAsTsvButton: FC<{query: string}> = ({query}) => {
  const {copyAsTsv} = useCopyAsTsv();
  const [isCopying, setIsCopying] = useState(false);

  const handleCopy = async () => {
    if (!query) return;
    try {
      toast.loading('Copying results to clipboard...');
      setIsCopying(true);
      const rowCount = await copyAsTsv(query);
      toast.success(
        rowCount === 1
          ? 'Copied 1 row'
          : `Copied ${rowCount.toLocaleString()} rows`,
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
      {isCopying ? <Spinner /> : <ClipboardIcon size={16} />}
    </Button>
  );
};
