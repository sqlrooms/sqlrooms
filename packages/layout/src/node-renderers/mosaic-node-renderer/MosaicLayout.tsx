import {FC} from 'react';
import {LayoutMosaicNode} from '@sqlrooms/layout-config';
import {RendererSwitcher} from '../RendererSwitcher';
import {LayoutNodeProvider} from '../../LayoutNodeContext';
import {LayoutPath} from '../../types';
import {MosaicLayoutPanel} from './MosaicLayoutPanel';
import {MosaicLayoutTilePanel} from './MosaicLayoutTilePanel';
import {MosaicLayoutTileContent} from './MosaicLayoutTileContent';
import {MosaicLayoutTileToolbar} from './MosaicLayoutTileToolbar';

interface RootProps {
  node: LayoutMosaicNode;
  path: LayoutPath;
}

export const Root: FC<RootProps> = ({node, path}) => {
  const defaultComponent = (
    <MosaicLayout.Panel
      tileComponent={(props) => (
        <MosaicLayout.TilePanel {...props}>
          <MosaicLayout.TileContent {...props} />
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
