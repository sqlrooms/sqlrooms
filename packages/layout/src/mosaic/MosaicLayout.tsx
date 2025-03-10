import React, {FC, useCallback} from 'react';
import {Mosaic, MosaicNode, MosaicProps} from 'react-mosaic-component';
import 'react-mosaic-component/react-mosaic-component.css';
import MosaicTile from './MosaicTile';

// Add custom styles for the mosaic split line hover effect
const customMosaicStyles = `
  .mosaic-split {
    background-color: hsl(var(--border) / 0.2);
  }
  .mosaic-split:hover {
    background-color: hsl(var(--primary) / 0.4);
  }
`;

const MosaicLayout: FC<MosaicProps<string>> = (props) => {
  const {onChange, onRelease, renderTile} = props;
  const [isDragging, setDragging] = React.useState(false);
  const handleLayoutChange = useCallback(
    (nodes: MosaicNode<string> | null) => {
      setDragging(true);
      onChange?.(nodes);
    },
    [onChange],
  );
  const handleLayoutRelease = useCallback(
    (newNode: MosaicNode<string> | null) => {
      setDragging(false);
      onRelease?.(newNode);
    },
    [onRelease],
  );

  return (
    <div className="bg relative h-full w-full">
      <style>{customMosaicStyles}</style>
      <Mosaic<string>
        {...props}
        className="" /* to avoid using blueprint theme */
        onChange={handleLayoutChange}
        onRelease={handleLayoutRelease}
        renderTile={(id, path) => (
          <MosaicTile
            id={id}
            className="bg-secondary/10"
            path={path}
            isDragging={isDragging}
            content={renderTile(id, path)}
          />
        )}
      />
    </div>
  );
};

export default MosaicLayout;
