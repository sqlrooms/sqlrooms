import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Spinner,
} from '@sqlrooms/ui';
import {Download, FileCode, Image} from 'lucide-react';
import {useState} from 'react';
import {useVegaChartContext} from './VegaChartContext';

export interface VegaExportActionProps {
  /**
   * PNG scale factor for high-DPI displays
   * @default 2
   */
  pngScale?: number;
  /**
   * Custom filename generator
   * @param format - The export format ('png' or 'svg')
   * @returns The filename to use for the download
   */
  getFilename?: (format: 'png' | 'svg') => string;
  /**
   * Additional CSS classes for the trigger button
   */
  className?: string;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Export action component for VegaLiteArrowChart.
 * Provides a dropdown menu with PNG and SVG export options.
 *
 * @example
 * ```tsx
 * <VegaLiteArrowChart spec={spec} arrowTable={data}>
 *   <VegaLiteArrowChart.Actions>
 *     <VegaExportAction pngScale={3} />
 *   </VegaLiteArrowChart.Actions>
 * </VegaLiteArrowChart>
 * ```
 *
 * @example
 * ```tsx
 * // With custom filename
 * <VegaExportAction
 *   getFilename={(format) => `my-chart-${Date.now()}.${format}`}
 * />
 * ```
 */
export const VegaExportAction: React.FC<VegaExportActionProps> = ({
  pngScale = 2,
  getFilename,
  className,
}) => {
  const {embed} = useVegaChartContext();
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPng = async () => {
    if (!embed?.view) return;
    setIsExporting(true);
    try {
      const canvas = await embed.view.toCanvas(pngScale);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      );
      if (blob) {
        downloadBlob(blob, getFilename?.('png') ?? `chart-${Date.now()}.png`);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSvg = async () => {
    if (!embed?.view) return;
    setIsExporting(true);
    try {
      const svg = await embed.view.toSVG();
      const blob = new Blob([svg], {type: 'image/svg+xml'});
      downloadBlob(blob, getFilename?.('svg') ?? `chart-${Date.now()}.svg`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    // Non-modal so closing the menu doesn't steal focus from other actions,
    // which can close other dropdowns right after opening.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          disabled={isExporting || !embed}
          className={cn(className)}
          aria-label="Export chart"
        >
          {isExporting ? (
            <Spinner className="h-4 w-4" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportPng}>
          <Image className="mr-2 h-4 w-4" />
          Save as PNG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportSvg}>
          <FileCode className="mr-2 h-4 w-4" />
          Save as SVG
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
