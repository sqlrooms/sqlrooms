import {FC} from 'react';
import {DockPreview} from './docking-types';

interface DockPreviewOverlayProps {
  preview: DockPreview | null;
}

export const DockPreviewOverlay: FC<DockPreviewOverlayProps> = ({preview}) => {
  if (!preview) {
    return null;
  }

  return (
    <div
      className="border-primary/35 bg-primary/5 pointer-events-none fixed z-50 rounded-md border"
      style={preview.containerStyle}
    >
      <div
        className="bg-primary/18 absolute rounded-sm"
        style={preview.highlightStyle}
      />
      <div className="bg-primary/60 absolute" style={preview.lineStyle} />
    </div>
  );
};
