import {FC} from 'react';
import {useBaseRoomShellStore} from '../RoomShellSlice';
import {FileDataSourceCard} from './FileDataSourceCard';

const FileDataSourcesPanel: FC<{isReadOnly?: boolean}> = ({isReadOnly}) => {
  const roomFiles = useBaseRoomShellStore((state) => state.room.roomFiles);
  const roomFilesProgress = useBaseRoomShellStore(
    (state) => state.room.roomFilesProgress,
  );

  return (
    <div className="flex grow flex-col overflow-auto">
      {roomFiles.map((fileInfo, i) => (
        <FileDataSourceCard
          key={i}
          isReadOnly={isReadOnly}
          fileInfo={fileInfo}
          fileState={roomFilesProgress[fileInfo.pathname]}
        />
      ))}
    </div>
  );
};

export {FileDataSourcesPanel};
