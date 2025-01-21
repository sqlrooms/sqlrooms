import {FC} from 'react';
import FileDataSourceCard from './FileDataSourceCard';
import {useBaseProjectStore} from '../../ProjectStateProvider';

const FileDataSourcesPanel: FC = () => {
  const projectFiles = useBaseProjectStore((state) => state.projectFiles);
  const projectFilesProgress = useBaseProjectStore(
    (state) => state.projectFilesProgress,
  );
  const isReadOnly = useBaseProjectStore((state) => state.isReadOnly);

  return (
    <div className="flex flex-col overflow-auto flex-grow">
      {/* <Heading
        pl={2}
        as="h3"
        fontSize="xs"
        textTransform="uppercase"
        >
        color="gray.400"
        Files
      </Heading> */}

      {/* {dbFilesQuery.data?.map((fileInfo, i) => (
            // eslint-disable-next-line react/jsx-no-undef
            <FilePanelFileCard key={i} fileInfo={fileInfo} />
          ))} */}
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

export default FileDataSourcesPanel;
