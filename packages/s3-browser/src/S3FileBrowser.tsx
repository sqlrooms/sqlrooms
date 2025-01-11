import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  Checkbox,
  Flex,
  HStack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import {ArrowUturnUpIcon, FolderIcon} from '@heroicons/react/24/outline';
import {formatBytes, formatTimeRelative} from '@sqlrooms/utils';
import {FC, useCallback, useEffect, useMemo} from 'react';
import { S3FileOrDirectory } from './S3FileOrDirectory';

type Props = {
  files?: S3FileOrDirectory[];
  selectedFiles: string[];
  selectedDirectory: string;
  onCanConfirmChange: (canConfirm: boolean) => void;
  onChangeSelectedDirectory: (directory: string) => void;
  onChangeSelectedFiles: (files: string[]) => void;
};

const S3FileBrowser: FC<Props> = (props) => {
  const {
    files,
    selectedDirectory,
    selectedFiles,
    onCanConfirmChange,
    onChangeSelectedFiles,
    onChangeSelectedDirectory,
  } = props;

  useEffect(() => {
    onCanConfirmChange(Boolean(selectedFiles?.length));
  }, [selectedFiles, onCanConfirmChange]);

  const handleSelectFile = useCallback(
    (key: string) => {
      if (selectedFiles.includes(key)) {
        onChangeSelectedFiles(selectedFiles.filter((id) => id !== key));
      } else {
        onChangeSelectedFiles([...selectedFiles, key]);
      }
    },
    [onChangeSelectedFiles, selectedFiles],
  );

  const handleSelectDirectory = useCallback(
    (key: string) => {
      onChangeSelectedDirectory(`${selectedDirectory}${key}/`);
    },
    [selectedDirectory, onChangeSelectedDirectory],
  );

  const filesInDirectory = useMemo(
    () => files?.filter(({isDirectory}) => !isDirectory) ?? [],
    [files],
  );

  const handleSelectAll = useCallback(() => {
    if (selectedFiles.length === filesInDirectory.length) {
      onChangeSelectedFiles([]);
    } else {
      onChangeSelectedFiles(filesInDirectory.map(({key}) => key) ?? []);
    }
  }, [filesInDirectory, onChangeSelectedFiles, selectedFiles.length]);

  const parentDirectory = useMemo(() => {
    const dir = selectedDirectory.split('/').slice(0, -2).join('/');
    return dir ? `${dir}/` : '';
  }, [selectedDirectory]);

  return (
    <Flex position="relative" width="100%" height="100%" overflow="hidden">
      <Flex
        position="absolute"
        width="100%"
        height="100%"
        overflowX="auto"
        overflowY="auto"
        display="flex"
        flexDirection="column"
        py={0}
        alignItems="flex-start"
      >
        <TableContainer
          width="100%"
          borderRadius="lg"
          border="1px solid"
          borderColor="gray.600"
          overflowY="auto"
        >
          <Table
            size="sm"
            __css={{
              borderCollapse: 'separate', // to keep header borders sticky
              borderSpacing: 0,
            }}
            width="100%"
          >
            <Thead>
              {selectedDirectory ? (
                <>
                  <Tr>
                    <Td colSpan={5} py={3} color="gray.100" bg="gray.800">
                      <HStack gap="2">
                        <Button
                          size="xs"
                          rightIcon={
                            <ArrowUturnUpIcon width={12} height={12} />
                          }
                          onClick={() =>
                            onChangeSelectedDirectory(parentDirectory)
                          }
                        >
                          ..
                        </Button>
                        <Breadcrumb fontSize="xs" color="blue.400">
                          <BreadcrumbItem>
                            <BreadcrumbLink
                              onClick={() => onChangeSelectedDirectory('')}
                            >
                              Home
                            </BreadcrumbLink>
                          </BreadcrumbItem>

                          {selectedDirectory.split('/').map((directory, i) => {
                            if (!directory) return null;
                            const path = selectedDirectory
                              .split('/')
                              .slice(0, i + 1)
                              .join('/')
                              .concat('/');
                            const isCurrent = path === selectedDirectory;
                            return (
                              <BreadcrumbItem key={i} isCurrentPage={isCurrent}>
                                <BreadcrumbLink
                                  {...(isCurrent
                                    ? {
                                        cursor: 'default',
                                        textDecoration: 'none',
                                        _hover: {textDecoration: 'none'},
                                      }
                                    : null)}
                                  onClick={() => {
                                    if (!isCurrent) {
                                      onChangeSelectedDirectory(path);
                                    }
                                  }}
                                >
                                  {directory}
                                </BreadcrumbLink>
                              </BreadcrumbItem>
                            );
                          })}
                        </Breadcrumb>
                      </HStack>
                    </Td>
                  </Tr>
                </>
              ) : null}
              <Tr position="sticky" zIndex={2} top={0} bgColor="gray.600">
                <Th width="1%">
                  <Checkbox
                    isChecked={selectedFiles.length === filesInDirectory.length}
                    onChange={handleSelectAll}
                  />
                </Th>
                <Th py="2" color="white">
                  Name
                </Th>
                <Th py="2" color="white">
                  Type
                </Th>
                <Th color="white" isNumeric>
                  Size
                </Th>
                <Th color="white" isNumeric>
                  Modified
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {files?.map((object) => {
                const {key, isDirectory} = object;
                return (
                  <Tr
                    key={key}
                    cursor="pointer"
                    color="blue.300"
                    _hover={{bgColor: 'blue.700', color: 'white'}}
                    onClick={(evt) => {
                      if (isDirectory) {
                        handleSelectDirectory(key);
                      } else {
                        handleSelectFile(key);
                        evt.preventDefault(); // prevent double change when clicking checkbox
                      }
                    }}
                  >
                    <Td>
                      <Checkbox
                        isDisabled={isDirectory}
                        isChecked={selectedFiles.includes(key)}
                      />
                    </Td>
                    <Td fontSize="xs">
                      {isDirectory ? (
                        <HStack>
                          <FolderIcon width={16} height={16} />
                          <Text>{`${key}/`}</Text>
                        </HStack>
                      ) : (
                        key
                      )}
                    </Td>
                    <Td fontSize="xs">
                      {isDirectory ? 'Directory' : object.contentType}
                    </Td>
                    <Td fontSize="xs" isNumeric>
                      {!isDirectory && object.size !== undefined
                        ? formatBytes(object.size)
                        : ''}
                    </Td>
                    <Td fontSize="xs" textAlign="right">
                      {!isDirectory && object.lastModified
                        ? formatTimeRelative(object.lastModified)
                        : ''}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </TableContainer>
      </Flex>
    </Flex>
  );
};

export default S3FileBrowser;
