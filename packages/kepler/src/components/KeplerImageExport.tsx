import React, {useCallback, useEffect} from 'react';
import {
  AccordionContent,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
  Checkbox,
} from '@sqlrooms/ui';
import type {
  ExportImage,
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

export interface KeplerImageExportProps {
  setExportImageSetting: (settings: Partial<ExportImage>) => void;
  cleanupExportImage: () => void;
  exportImageSettings: ExportImage;
  fileName?: string;
}

export const KeplerImageExport: React.FC<KeplerImageExportProps> = ({
  setExportImageSetting,
  cleanupExportImage,
  exportImageSettings,
  fileName,
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
      const file = dataURItoBlob(imageDataUri);
      downloadFile(file, `${fileName || 'Untitled'}.png`);
    }
  }, [processing, imageDataUri, fileName]);

  return (
    <AccordionContent className="flex flex-col gap-4 px-[5px] pb-5 pt-1">
      <Label>Preview</Label>
      <ImagePreview exportImage={exportImageSettings} />
      <div className="flex flex-col space-y-2">
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
      </div>

      <div>
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
      </div>

      <div className="flex flex-row items-center space-x-2">
        <Checkbox
          checked={legend}
          onCheckedChange={(checked) =>
            setExportImageSetting({
              legend: checked === true,
            })
          }
        />
        <Label className="font-normal">Include legend</Label>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          className="w-full"
          onClick={handleExportImage}
        >
          Export Image
        </Button>
      </div>
    </AccordionContent>
  );
};
