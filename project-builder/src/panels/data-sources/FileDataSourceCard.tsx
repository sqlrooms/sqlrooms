import {
  Flex,
  Spacer,
  Menu,
  MenuButton,
  IconButton,
  Portal,
  MenuList,
  MenuItem,
  Progress,
  Text,
  Tooltip,
  Alert,
  AlertIcon,
  Icon,
} from '@chakra-ui/react';
import {
  EllipsisHorizontalIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/solid';
import {
  DocumentTextIcon,
  CloudArrowUpIcon,
  CloudArrowDownIcon,
  CloudIcon,
} from '@heroicons/react/24/outline';
import {formatBytes} from '@flowmapcity/utils';
import React, {FC, useCallback} from 'react';
import {ProjectFileInfo, ProjectFileState} from '../../types';
import {useProjectStore} from '@flowmapcity/project-builder';

type Props = {
  isReadOnly?: boolean;
  fileInfo: ProjectFileInfo;
  fileState?: ProjectFileState;
};

const FileDataSourceCard: FC<Props> = (props) => {
  const {isReadOnly, fileInfo, fileState} = props;
  const {pathname, size} = fileInfo;
  const removeProjectFile = useProjectStore((state) => state.removeProjectFile);
  const handleRemoveFromProject = useCallback(() => {
    removeProjectFile(fileInfo.pathname);
  }, [fileInfo.pathname, removeProjectFile]);

  return (
    <Flex p={2} gap={1} flexDir="column">
      <Flex
        gap={1}
        cursor="pointer"
        // _hover={{
        //   color: theme.colors.blue[300],
        //   // textDecoration: 'underline',
        // }}
        flexDir="row"
        alignItems="center"
      >
        <Flex flex="0 0 15px">
          <DocumentTextIcon width="15px" />
        </Flex>
        <Flex flex="1 1 auto" overflow="hidden" textOverflow="ellipsis">
          <Text
            fontSize="xs"
            wordBreak="break-word"
            // fontFamily="mono"
            // noOfLines={1}

            //whiteSpace={'nowrap'}
          >
            {pathname}
          </Text>
        </Flex>
        <Spacer />

        {!isReadOnly ? (
          <Menu placement={'bottom-start'}>
            <MenuButton
              size="xs"
              as={IconButton}
              aria-label="Options"
              icon={<EllipsisHorizontalIcon width="20px" />}
              variant="ghost"
              color={'gray.400'}
              // onClick={() => onSelect(tableName)}
            />
            <Portal>
              <MenuList minWidth="120px">
                {/* <MenuItem
            fontSize={'sm'}
            icon={<PencilIcon width="15px" />}
          >
            Rename
          </MenuItem> */}
                <MenuItem
                  fontSize={'sm'}
                  icon={<XMarkIcon width="15px" />}
                  onClick={handleRemoveFromProject}
                >
                  Remove from project
                </MenuItem>
                <MenuItem
                  fontSize={'sm'}
                  icon={<ArrowDownTrayIcon width="15px" />}
                  onClick={console.log}
                  isDisabled
                >
                  Download file
                </MenuItem>
              </MenuList>
            </Portal>
          </Menu>
        ) : null}
      </Flex>
      <Flex flexDir="row" gap={1} alignItems="center">
        {fileState?.status === 'error' ? (
          <Alert
            status="error"
            fontSize="xs"
            flex="1 1 auto"
            py="0"
            px="1"
            bg="red.900"
          >
            <AlertIcon />
            {fileState.message}
          </Alert>
        ) : fileState?.status === 'download' ||
          fileState?.status === 'upload' ? (
          <Progress
            width="100%"
            colorScheme="green"
            size="xs"
            value={(fileState.progress?.ratio ?? 0) * 100}
            isIndeterminate={fileState.progress === undefined}
          />
        ) : null}
        <Spacer />
        {size !== undefined ? (
          <Text
            fontSize="xs"
            color="gray.500"
            minWidth="70px"
            textAlign="right"
          >
            {formatBytes(size)}
          </Text>
        ) : null}
        <Tooltip
          fontSize="xs"
          label={
            fileState?.status === 'done'
              ? 'File synced'
              : fileState?.status === 'download'
              ? 'Downloading file…'
              : fileState?.status === 'upload'
              ? 'Uploading file…'
              : fileState?.status === 'error'
              ? `Failed to sync file: ${fileState.message}`
              : 'File not synced'
          }
          hasArrow
        >
          <Flex cursor="pointer">
            {fileState?.status === 'done' ? (
              <Icon as={CloudIcon} width="15px" color="green.400" />
            ) : fileState?.status === 'download' ? (
              <Icon as={CloudArrowDownIcon} width="15px" color="orange" />
            ) : fileState?.status === 'upload' ? (
              <Icon as={CloudArrowUpIcon} width="15px" color="orange" />
            ) : fileState?.status === 'error' ? (
              <Icon as={CloudIcon} width="15px" color="red" />
            ) : (
              <Icon as={CloudIcon} width="15px" color="orange" />
            )}
          </Flex>
        </Tooltip>
      </Flex>
    </Flex>
  );
};

export default FileDataSourceCard;
