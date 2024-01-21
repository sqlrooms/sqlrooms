import {Flex} from '@chakra-ui/react';
import {useProjectStore} from '@flowmapcity/project-builder';
import React, {FC} from 'react';
import FileDataSourceCard from './FileDataSourceCard';
type Props = {
  // no props
};
const FileDataSourcesPanel: FC<Props> = (props) => {
  const {} = props;
  const projectFiles = useProjectStore((state) => state.projectFiles);
  const projectFilesProgress = useProjectStore(
    (state) => state.projectFilesProgress,
  );
  const isReadOnly = useProjectStore((state) => state.isReadOnly);

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
