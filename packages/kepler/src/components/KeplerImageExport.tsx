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
import type {
  ImageRatioOption,
  ImageResolutionOption,
} from '@kepler.gl/constants';
import {
  EXPORT_IMG_RATIOS,
  RESOLUTIONS,
  EXPORT_IMG_RATIO_OPTIONS,
  EXPORT_IMG_RESOLUTION_OPTIONS,
} from '@kepler.gl/constants';
import {FormattedMessage} from '@kepler.gl/localization';
import {ImagePreview} from '@kepler.gl/components';
import {dataURItoBlob, downloadFile} from '@kepler.gl/utils';
import {ExportImage} from '@kepler.gl/types';

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
  const {legend, ratio, resolution, processing, imageDataUri} =
    exportImageSettings;

  useEffect(() => {
    setExportImageSetting({
      exporting: true,
    });
    return cleanupExportImage;
  }, [setExportImageSetting, cleanupExportImage]);

  const handleExportImage = useCallback(() => {
    if (!processing && imageDataUri) {
      onExportStart?.();
      const file = dataURItoBlob(imageDataUri);
      downloadFile(file, `${fileName || 'Untitled'}.png`);
    }
  }, [processing, imageDataUri, fileName, onExportStart]);

  return (
    <div className="flex flex-col gap-6 px-[5px] pb-5 pt-1">
      <ImagePreview exportImage={exportImageSettings} />
      <div className="grid grid-cols-[100px_auto] items-center gap-4">
        <Label>Resolution</Label>
        <Select
          value={resolution}
          onValueChange={(value) =>
            setExportImageSetting({
              resolution: value as keyof typeof RESOLUTIONS,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select resolution" />
          </SelectTrigger>
          <SelectContent>
            {EXPORT_IMG_RESOLUTION_OPTIONS.map(
              (option: ImageResolutionOption) => (
                <SelectItem
                  key={option.id}
                  value={option.id}
                  disabled={!option.available}
                >
                  {option.label}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>

        <Label>Ratio</Label>
        <Select
          value={ratio}
          onValueChange={(value) =>
            setExportImageSetting({
              ratio: value as keyof typeof EXPORT_IMG_RATIOS,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select ratio" />
          </SelectTrigger>
          <SelectContent>
            {EXPORT_IMG_RATIO_OPTIONS.filter(
              (op: ImageRatioOption) => !op.hidden,
            ).map((option: ImageRatioOption) => (
              <SelectItem key={option.id} value={option.id}>
                <FormattedMessage id={option.label} />
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
        />
      </div>

      <div className="flex flex-col gap-2">
        <Button
          variant="default"
          className="w-full"
          onClick={handleExportImage}
        >
          Export Image
        </Button>
      </div>
    </div>
  );
};
