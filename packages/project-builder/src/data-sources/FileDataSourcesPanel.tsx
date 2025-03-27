import {FC} from 'react';
import {FileDataSourceCard} from './FileDataSourceCard';
import {useBaseProjectBuilderStore} from '../ProjectBuilderStore';

const FileDataSourcesPanel: FC = () => {
  const projectFiles = useBaseProjectBuilderStore(
    (state) => state.project.projectFiles,
  );
  const projectFilesProgress = useBaseProjectBuilderStore(
    (state) => state.project.projectFilesProgress,
  );
  const isReadOnly = useBaseProjectBuilderStore(
    (state) => state.project.isReadOnly,
  );

  return (
    <div className="flex flex-grow flex-col overflow-auto">
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
