import {FC} from 'react';
import {FileDataSourceCard} from './FileDataSourceCard';
import {useBaseProjectBuilderStore} from '../ProjectBuilderStore';

const FileDataSourcesPanel: FC<{isReadOnly?: boolean}> = ({isReadOnly}) => {
  const projectFiles = useBaseProjectBuilderStore(
    (state) => state.project.projectFiles,
  );
  const projectFilesProgress = useBaseProjectBuilderStore(
    (state) => state.project.projectFilesProgress,
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
