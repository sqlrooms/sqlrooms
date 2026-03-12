import {useCopyAsTsv} from '@sqlrooms/duckdb';
import {Button, Spinner, toast} from '@sqlrooms/ui';
import {ClipboardIcon} from 'lucide-react';
import {FC, useState} from 'react';

export const CopyAsTsvButton: FC<{query: string}> = ({query}) => {
  const {copyAsTsv} = useCopyAsTsv();
  const [isCopying, setIsCopying] = useState(false);

  const handleCopy = async () => {
    if (!query) {
      return;
    }

    const loadingToastId = toast.loading('Copying results to clipboard...');

    try {
      setIsCopying(true);
      const rowCount = await copyAsTsv(query);
      toast.success(
        rowCount === 1
          ? 'Copied 1 row'
          : `Copied ${rowCount.toLocaleString()} rows`,
      );
    } catch (error) {
      toast.error('Failed to copy to clipboard', {
        description:
          error instanceof Error ? error.message : 'An unknown error occurred',
      });
    } finally {
      toast.dismiss(loadingToastId);

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
