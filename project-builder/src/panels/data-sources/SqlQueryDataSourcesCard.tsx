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
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import {PiFileSql} from 'react-icons/pi';
import {EllipsisHorizontalIcon, XMarkIcon} from '@heroicons/react/24/solid';
import React, {FC, useCallback} from 'react';
import {useProjectStore, DataSourceStatus} from '@flowmapcity/project-builder';
import {SqlQueryDataSource} from '@flowmapcity/project-config';

type Props = {
  isReadOnly?: boolean;
  dataSource: SqlQueryDataSource;
};

const SqlQueryDataSourcesCard: FC<Props> = (props) => {
  const {isReadOnly, dataSource} = props;
  const {tableName} = dataSource;
  const dataSourceStates = useProjectStore((state) => state.dataSourceStates);
  const dsState = dataSourceStates[tableName];
  const removeSqlQueryDataSource = useProjectStore(
    (state) => state.removeSqlQueryDataSource,
  );
  const handleRemoveSqlQueryDataSource = useCallback(() => {
    removeSqlQueryDataSource(tableName);
  }, [removeSqlQueryDataSource, tableName]);

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
          <PiFileSql width="15px" />
        </Flex>
        <Flex flex="1 1 auto" overflow="hidden" textOverflow="ellipsis">
          <Text
            fontSize="xs"
            wordBreak="break-word"
            // fontFamily="mono"
            // noOfLines={1}

            //whiteSpace={'nowrap'}
          >
            {tableName}
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
                  onClick={handleRemoveSqlQueryDataSource}
                >
                  Remove from project
                </MenuItem>
                {/* <MenuItem
                  fontSize={'sm'}
                  icon={<ArrowDownTrayIcon width="15px" />}
                  onClick={console.log}
                  isDisabled
                >
                  Download file
                </MenuItem> */}
              </MenuList>
            </Portal>
          </Menu>
        ) : null}
      </Flex>
      <Flex flexDir="row" gap={1} alignItems="center">
        {dsState.status === DataSourceStatus.ERROR ? (
          <Alert
            status="error"
            fontSize="xs"
            flex="1 1 auto"
            py="0"
            px="1"
            bg="red.900"
          >
            <AlertIcon />
            {dsState.message}
          </Alert>
        ) : dsState.status === DataSourceStatus.FETCHING ? (
          <Progress
            width="100%"
            colorScheme="green"
            size="xs"
            isIndeterminate={true}
          />
        ) : null}
        <Spacer />
        {/* {size !== undefined ? (
          <Text
            fontSize="xs"
            color="gray.500"
            minWidth="70px"
            textAlign="right"
          >
            {formatBytes(size)}
          </Text>
        ) : null} */}
        {/* <Tooltip
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
        </Tooltip> */}
      </Flex>
    </Flex>
  );
};

export default SqlQueryDataSourcesCard;
