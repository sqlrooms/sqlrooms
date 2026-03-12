import React, {useCallback, useEffect} from 'react';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
  Switch,
} from '@sqlrooms/ui';
import {EXPORT_IMG_RESOLUTION_OPTIONS} from '@kepler.gl/constants';
import {ImagePreview} from '@kepler.gl/components';
import {dataURItoBlob, downloadFile} from '@kepler.gl/utils';
import {ExportImage} from '@kepler.gl/types';
import {Loader2} from 'lucide-react';

export interface KeplerImageExportProps {
  setExportImageSetting: (settings: Partial<ExportImage>) => void;
  cleanupExportImage: () => void;
  exportImageSettings: ExportImage;
  fileName?: string;
  onExportStart?: () => void;
}

export const KeplerImageExport: React.FC<KeplerImageExportProps> = ({
  setExportImageSetting,
  cleanupExportImage,
  exportImageSettings,
  fileName,
  onExportStart,
}) => {
  const {legend, resolution, processing, imageDataUri, imageSize} =
    exportImageSettings;

  useEffect(() => {
    setExportImageSetting({
      exporting: true,
    });
    return cleanupExportImage;
  }, [setExportImageSetting, cleanupExportImage]);

  // Trigger preview regeneration when resolution or legend changes
  useEffect(() => {
    setExportImageSetting({
      imageDataUri: '',
    });
  }, [resolution, legend, setExportImageSetting]);

  const handleExportImage = useCallback(() => {
    if (!processing && imageDataUri) {
      onExportStart?.();
      const file = dataURItoBlob(imageDataUri);
      downloadFile(file, `${fileName || 'Untitled'}.png`);
    }
  }, [processing, imageDataUri, fileName, onExportStart]);

  const isPreviewReady = !processing && imageDataUri;

  return (
    <div className="flex flex-col gap-6 px-[5px] pt-1 pb-5">
      <ImagePreview exportImage={exportImageSettings} />

      {processing && (
        <div className="flex items-center justify-center gap-2 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          <span className="text-sm text-gray-600">Generating preview...</span>
        </div>
      )}

      <div className="grid grid-cols-[100px_auto] items-center gap-4">
        <Label>Resolution</Label>
        <Select
          value={resolution}
          onValueChange={(value: string) =>
            setExportImageSetting({
              resolution: value as string,
            })
          }
          disabled={processing}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select resolution" />
          </SelectTrigger>
          <SelectContent>
            {EXPORT_IMG_RESOLUTION_OPTIONS.map((option) => (
              <SelectItem
                key={option.id}
                value={option.id}
                disabled={!option.available}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Label className="font-normal">Show legend</Label>
        <Switch
          checked={legend}
          onCheckedChange={(checked) =>
            setExportImageSetting({
              legend: checked === true,
            })
          }
          disabled={processing}
        />
      </div>

      {isPreviewReady && imageSize && (
        <div className="text-sm text-gray-600">
          Export size: {imageSize.imageW} × {imageSize.imageH} px
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button
          variant="default"
          className="w-full"
          onClick={handleExportImage}
          disabled={processing || !isPreviewReady}
        >
          {processing ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </span>
          ) : (
            'Export Image'
          )}
        </Button>
      </div>
    </div>
  );
};
