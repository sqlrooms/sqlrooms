import {Flex} from '@chakra-ui/react';
import {ProjectPanelTypes} from '@sqlrooms/project-config';
import {FC} from 'react';
import {MosaicBranch, MosaicWindow} from 'react-mosaic-component';

const ENABLE_LAYOUT_REARRANGE = false;

type Props = {
  id: string;
  path: MosaicBranch[];
  content: React.ReactNode;
  isDragging: boolean;
};

const MosaicTile: FC<Props> = (props) => {
  const {id, content, path, isDragging} = props;
  const body = (
    <Flex
      grow="1"
      height="100%"
      // gap={1}
      p={2}
      direction={'column'}
      // border={"1px solid red"}
      // width={"100%"}
      // height={"100%"}
      borderRadius="sm"
      overflow="hidden"
      bg={'gray.700'}
      pointerEvents={isDragging ? 'none' : undefined}
    >
      {content}
    </Flex>
  );
  if (!ENABLE_LAYOUT_REARRANGE || id === ProjectPanelTypes.MAIN_VIEW) {
    return body;
  }
  return (
    <MosaicWindow<string>
      title={id}
      // additionalControls={
      // }
      // createNode={() => genRandomStr(6)}
      path={path}
      // onDragStart={() => console.log('MosaicWindow.onDragStart')}
      // onDragEnd={(type) => console.log('MosaicWindow.onDragEnd', type)}
      renderToolbar={() =>
        id === ProjectPanelTypes.MAIN_VIEW ? (
          <div />
        ) : (
          <div style={{display: 'flex', width: '100%', height: '100%'}}>
            {/* <ProjectBuilderPanelHeader panelKey={id as ProjectPanelTypes} /> */}
          </div>
        )
      }
    >
      {body}
    </MosaicWindow>
  );
};

export default MosaicTile;
