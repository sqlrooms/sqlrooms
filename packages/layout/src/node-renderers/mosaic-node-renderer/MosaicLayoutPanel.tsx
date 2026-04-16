import {FC, JSX, useCallback} from 'react';
import {TileRenderer} from 'react-mosaic-component';
import {Mosaic} from 'react-mosaic-component';
import 'react-mosaic-component/react-mosaic-component.css';
import {useMosaicRendererLayout} from './useMosaicRendererLayout';
import {useMosaicNodeContext} from '../../LayoutNodeContext';
import {MosaicLayoutTilePanelProps} from './MosaicLayoutTilePanel';

const mosaicStyles = `
  .mosaic-split {
    z-index: 10;
  }
  .mosaic-split-line {
    width: 100%;
    height: 100%;
    background-color: hsl(var(--border) / 0.2);
  }
  .mosaic-split:hover .mosaic-split-line {
    background-color: hsl(var(--primary) / 0.4);
  }
  .mosaic-root {
    top: 0; left: 0; right: 0; bottom: 0;
  }
  .mosaic-window-toolbar {
    background: var(--color-background) !important;
    position: relative;
    z-index: 1;
  }
  .mosaic-tile {
    margin: 0;
  }
  .mosaic-tabs-toolbar {
    display: none !important;
  }
  .mosaic-window-body {
    background: var(--color-background) !important;
  }
`;

type MosaicLayoutPanelProps = {
  tileComponent: (tileProps: MosaicLayoutTilePanelProps) => JSX.Element;
};

export const MosaicLayoutPanel: FC<MosaicLayoutPanelProps> = ({
  tileComponent,
}) => {
  const {node} = useMosaicNodeContext();

  const {value, handleChange} = useMosaicRendererLayout(node);

  const renderTile: TileRenderer<string> = useCallback(
    (id, path) => {
      return tileComponent({panelId: id, tilePath: path});
    },
    [tileComponent],
  );

  return (
    <div className="relative h-full w-full">
      <style>{mosaicStyles}</style>
      <Mosaic<string>
        value={value}
        onChange={handleChange}
        renderTile={renderTile}
        className=""
      />
    </div>
  );
};
