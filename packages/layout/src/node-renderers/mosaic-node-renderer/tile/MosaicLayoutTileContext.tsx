import {createContext, FC, PropsWithChildren, useContext} from 'react';

import {MosaicPath} from 'react-mosaic-component';
import {LayoutPath, RoomPanelInfo} from '../../../types';

export type MosaicLayoutTileContextValue = {
  panelId: string;
  tilePath: MosaicPath;
  panel: RoomPanelInfo | null;
  path: LayoutPath;
};

export const MosaicLayoutTileContext =
  createContext<MosaicLayoutTileContextValue | null>(null);

export const MosaicLayoutTileProvider: FC<
  PropsWithChildren<MosaicLayoutTileContextValue>
> = ({children, ...value}) => {
  return (
    <MosaicLayoutTileContext.Provider value={value}>
      {children}
    </MosaicLayoutTileContext.Provider>
  );
};

export function useMosaicLayoutTileContext(): MosaicLayoutTileContextValue {
  const context = useContext(MosaicLayoutTileContext);
  if (!context) {
    throw new Error(
      'useMosaicLayoutTileContext must be used within MosaicLayoutTileProvider',
    );
  }

  return context;
}
