import {MosaicLayout} from '@sqlrooms/layout';
import {FC} from 'react';

export const DashboardPanel: FC = () => {
  return (
    <MosaicLayout.Panel
      tileRenderer={() => (
        <MosaicLayout.TilePanel toolbarRenderer={() => <CustomToolbar />}>
          <MosaicLayout.TileContent />
        </MosaicLayout.TilePanel>
      )}
    />
  );
};

const CustomToolbar: FC = () => {
  const {panel, panelId} = MosaicLayout.useTileContext();

  const Icon = panel?.icon;
  const title = panel?.title ?? panelId;

  return (
    <div className="flex w-full items-center justify-between p-2">
      <div className="flex items-center">
        {Icon && <Icon className="mr-2 h-5 w-5" />}
        <span className="text-lg capitalize">{title}</span>
      </div>
      <div className="flex items-center">
        <MosaicLayout.TileCloseButton />
      </div>
    </div>
  );
};
