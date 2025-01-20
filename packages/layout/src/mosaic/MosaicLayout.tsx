import styled from '@emotion/styled';
import React, {FC, useCallback} from 'react';
import {Mosaic, MosaicNode, MosaicProps} from 'react-mosaic-component';
import MosaicTile from './MosaicTile';
import 'react-mosaic-component/react-mosaic-component.css';

type Props = MosaicProps<string>;

const StyledMosaicLayout = styled.div`
  position: relative;
  width: 100%;
  height: 100%;

  .mosaic.mosaic-blueprint-theme {
    background-color: unset !important;
  }

  .mosaic.mosaic-blueprint-theme .mosaic-zero-state {
    background-color: unset !important;
  }
`;

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
    <StyledMosaicLayout className="MosaicLayout">
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
    </StyledMosaicLayout>
  );
};

export default MosaicLayout;
