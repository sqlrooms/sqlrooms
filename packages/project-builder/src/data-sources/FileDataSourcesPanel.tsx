import {FC} from 'react';
import {FileDataSourceCard} from './FileDataSourceCard';
import {useBaseProjectStore} from '../ProjectStateProvider';

const FileDataSourcesPanel: FC = () => {
  const projectFiles = useBaseProjectStore((state) => state.projectFiles);
  const projectFilesProgress = useBaseProjectStore(
    (state) => state.projectFilesProgress,
  );
  const isReadOnly = useBaseProjectStore((state) => state.isReadOnly);

  return (
    <div className="flex flex-col overflow-auto flex-grow">
      {projectFiles.map((fileInfo, i) => (
        <FileDataSourceCard
          key={i}
          isReadOnly={isReadOnly}
          fileInfo={fileInfo}
          fileState={projectFilesProgress[fileInfo.pathname]}
        />
      ))}
    </div>
  );
};

export {FileDataSourcesPanel};
