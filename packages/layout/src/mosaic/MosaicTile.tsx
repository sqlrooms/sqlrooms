import {MAIN_VIEW} from '@sqlrooms/project-config';
import {cn} from '@sqlrooms/ui';
import {FC} from 'react';
import {MosaicBranch, MosaicWindow} from 'react-mosaic-component';

const ENABLE_LAYOUT_REARRANGE = false;

const MosaicTile: FC<{
  id: string;
  path: MosaicBranch[];
  content: React.ReactNode;
  isDragging: boolean;
}> = (props) => {
  const {id, content, path, isDragging} = props;
  const body = (
    <div
      className={cn(
        'flex-1 h-full p-2 flex-col bg-gray-700 rounded-md overflow-hidden',
        isDragging ? 'pointer-events-none' : '',
      )}
    >
      {content}
    </div>
  );
  if (!ENABLE_LAYOUT_REARRANGE || id === MAIN_VIEW) {
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
        id === MAIN_VIEW ? (
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
