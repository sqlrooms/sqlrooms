import {FC} from 'react';
import {LayoutMosaicNode} from '@sqlrooms/layout-config';
import {RendererSwitcher} from '../RendererSwitcher';
import {LayoutNodeProvider} from '../../LayoutNodeContext';
import {LayoutPath} from '../../types';
import {MosaicLayoutPanel} from './MosaicLayoutPanel';
import {MosaicLayoutTileContent} from './tile/MosaicLayoutTileContent';
import {MosaicLayoutTilePanel} from './tile/MosaicLayoutTilePanel';
import {MosaicLayoutTileToolbar} from './tile/MosaicLayoutTileToolbar';

interface RootProps {
  node: LayoutMosaicNode;
  path: LayoutPath;
}

export const Root: FC<RootProps> = ({node, path}) => {
  const defaultComponent = (
    <MosaicLayout.Panel
      tileRenderer={() => (
        <MosaicLayout.TilePanel>
          <MosaicLayout.TileContent />
        </MosaicLayout.TilePanel>
      )}
    />
  );

  return (
    <LayoutNodeProvider containerType="mosaic" node={node} path={path}>
      <div className="h-full w-full overflow-hidden p-2">
        <RendererSwitcher path={path} defaultComponent={defaultComponent} />
      </div>
    </LayoutNodeProvider>
  );
};

export const MosaicLayout = {
  Root,
  Panel: MosaicLayoutPanel,
  TilePanel: MosaicLayoutTilePanel,
  TileContent: MosaicLayoutTileContent,
  TileToolbar: MosaicLayoutTileToolbar,
};
