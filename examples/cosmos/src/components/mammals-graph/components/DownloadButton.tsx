import {FC} from 'react';
import {Button} from '@sqlrooms/ui';
import {Download} from 'lucide-react';

interface DownloadButtonProps {
  nodes: string[];
}

export const DownloadButton: FC<DownloadButtonProps> = ({nodes}) => {
  const handleDownload = () => {
    const data = nodes.join('\n');
    const blob = new Blob([data], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mammals.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleDownload}>
      <Download className="h-4 w-4" />
    </Button>
  );
};
