import {Flex} from '@chakra-ui/react';
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
    <>
      {/* <Heading
        pl={2}
        as="h3"
        fontSize="xs"
        textTransform="uppercase"
        >
        color="gray.400"
        Files
      </Heading> */}

      <Flex flexDir="column" overflow="auto" flexGrow="1">
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
      </Flex>
    </>
  );
};

export default FileDataSourcesPanel;
