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
  className?: string;
}> = (props) => {
  const {id, content, path, isDragging, className} = props;
  const body = (
    <div
      className={cn(
        'h-full flex-1 flex-col overflow-hidden rounded-md p-2',
        className,
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
