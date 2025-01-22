import React, {FC, useCallback} from 'react';
import {Mosaic, MosaicNode, MosaicProps} from 'react-mosaic-component';
import 'react-mosaic-component/react-mosaic-component.css';
import MosaicTile from './MosaicTile';

type Props = MosaicProps<string>;

const MosaicLayout: FC<Props> = (props) => {
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
    <div className="relative w-full h-full">
      <Mosaic<string>
        {...props}
        onChange={handleLayoutChange}
        onRelease={handleLayoutRelease}
        renderTile={(id, path) => (
          <MosaicTile
            id={id}
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
