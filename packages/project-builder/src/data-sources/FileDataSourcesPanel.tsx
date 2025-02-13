import {FC} from 'react';
import {useBaseProjectStore} from '../ProjectStateProvider';
import {FileDataSourceCard} from './FileDataSourceCard';

const FileDataSourcesPanel: FC = () => {
  const projectFiles = useBaseProjectStore(
    (state) => state.project.projectFiles,
  );
  const projectFilesProgress = useBaseProjectStore(
    (state) => state.project.projectFilesProgress,
  );
  const isReadOnly = useBaseProjectStore((state) => state.project.isReadOnly);

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
