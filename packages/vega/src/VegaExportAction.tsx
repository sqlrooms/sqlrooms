import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Spinner,
} from '@sqlrooms/ui';
import {Download, FileCode, FileSpreadsheet, Image} from 'lucide-react';
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
   * @param format - The export format ('png', 'svg', or 'csv')
   * @returns The filename to use for the download
   */
  getFilename?: (format: 'png' | 'svg' | 'csv') => string;
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
 * Collect all external stylesheet rules that could affect SVG rendering
 * (e.g. injected <style> for interactive edit modes) and inline them
 * into the SVG so the exported image is self-contained.
 */
function inlineExternalStyles(svgEl: SVGSVGElement): void {
  const sheets = document.styleSheets;
  let cssText = '';
  for (let i = 0; i < sheets.length; i++) {
    try {
      const rules = sheets[i]?.cssRules;
      if (!rules) continue;
      for (let j = 0; j < rules.length; j++) {
        cssText += rules[j]!.cssText + '\n';
      }
    } catch {
      // Cross-origin stylesheets will throw — skip them
    }
  }
  if (!cssText) return;
  const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleEl.textContent = cssText;
  svgEl.insertBefore(styleEl, svgEl.firstChild);
}

/**
 * Render an SVG element to a canvas at the given scale, capturing all
 * DOM-level modifications (transform attributes, display:none, etc.)
 * that Vega's view.toCanvas() would miss.
 */
async function svgToCanvas(
  svgEl: SVGSVGElement,
  scale: number,
): Promise<HTMLCanvasElement> {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  inlineExternalStyles(clone);

  const width = svgEl.clientWidth || svgEl.getBoundingClientRect().width;
  const height = svgEl.clientHeight || svgEl.getBoundingClientRect().height;

  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  if (!clone.getAttribute('viewBox')) {
    clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const blob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(blob);

  const img = new window.Image();
  img.width = width * scale;
  img.height = height * scale;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, width, height);

  URL.revokeObjectURL(url);
  return canvas;
}

function escapeCsvValue(value: unknown): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const firstRow = rows[0]!;
  const headers = Object.keys(firstRow);
  const lines = [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) => headers.map((h) => escapeCsvValue(row[h])).join(',')),
  ];
  return lines.join('\n');
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
      const container = embed.view.container() as HTMLElement | undefined;
      const svgEl = container?.querySelector('svg') as SVGSVGElement | null;

      let blob: Blob | null = null;
      if (svgEl) {
        const canvas = await svgToCanvas(svgEl, pngScale);
        blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/png'),
        );
      } else {
        const canvas = await embed.view.toCanvas(pngScale);
        blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/png'),
        );
      }
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
      const container = embed.view.container() as HTMLElement | undefined;
      const svgEl = container?.querySelector('svg') as SVGSVGElement | null;

      let svgString: string;
      if (svgEl) {
        const clone = svgEl.cloneNode(true) as SVGSVGElement;
        inlineExternalStyles(clone);
        const width = svgEl.clientWidth || svgEl.getBoundingClientRect().width;
        const height = svgEl.clientHeight || svgEl.getBoundingClientRect().height;
        clone.setAttribute('width', String(width));
        clone.setAttribute('height', String(height));
        if (!clone.getAttribute('viewBox')) {
          clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
        }
        svgString = new XMLSerializer().serializeToString(clone);
      } else {
        svgString = await embed.view.toSVG();
      }
      const blob = new Blob([svgString], {type: 'image/svg+xml'});
      downloadBlob(blob, getFilename?.('svg') ?? `chart-${Date.now()}.svg`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCsv = async () => {
    if (!embed?.view) return;
    setIsExporting(true);
    try {
      const view = embed.view;
      // Vega-Lite compiles to different dataset names depending on transforms.
      // Access the runtime data store to find the best dataset to export.
      const runtimeData = (view as unknown as {_runtime: {data: Record<string, unknown>}})._runtime?.data;
      let rows: Record<string, unknown>[] = [];
      if (runtimeData) {
        const names = Object.keys(runtimeData);
        // Prefer source_0 (raw data) over transformed datasets
        const preferred = ['source_0', 'data_0', ...names];
        for (const name of preferred) {
          try {
            const d = view.data(name);
            if (Array.isArray(d) && d.length > 0) {
              rows = d as Record<string, unknown>[];
              break;
            }
          } catch {
            // dataset name not found, try next
          }
        }
      }
      if (rows.length === 0) return;
      const csv = rowsToCsv(rows);
      const blob = new Blob([csv], {type: 'text/csv;charset=utf-8'});
      downloadBlob(blob, getFilename?.('csv') ?? `chart-${Date.now()}.csv`);
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
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleExportCsv}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Save as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
