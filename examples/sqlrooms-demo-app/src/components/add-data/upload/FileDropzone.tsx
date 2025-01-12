import {FC} from 'react';
import {useDropzone} from 'react-dropzone';

import {Flex, FlexProps, HStack, Icon, Text} from '@chakra-ui/react';
import {DocumentPlusIcon} from '@heroicons/react/24/solid';

const ACCEPTED_FORMATS = {
  'text/csv': ['.csv', '.tsv'],
  'application/json': ['.json'],
  'application/x-ndjson': ['.ndjson'],
  'application/octet-stream': ['.parquet'],
};

export type FileTableInfo = {
  file: File;
  tableName: string;
};

export type Props = Partial<Omit<FlexProps, 'onDrop'>> & {
  isInvalid?: boolean;
  onDrop: (files: File[]) => void;
  multiple?: boolean;
};

// eslint-disable-next-line quotes
const borderBackground = `url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='3' ry='3' stroke='%23A2A2A23B' stroke-width='2.5' stroke-dasharray='2%2c6' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e")`;

const FileDropzone: FC<Props> = (props) => {
  const {isInvalid, onDrop, multiple = false, ...rest} = props;

  // const csvFilesAdded = useRef<Set<string>>(new Set());
  // useEffect(() => {
  //   (async () => {
  //     if (storeTables.length) {
  //       for (const [fname, content] of Object.entries(storeTables)) {
  //         console.log('fname', fname, csvFilesAdded.current.has(fname));
  //         if (!csvFilesAdded.current.has(fname)) {
  //           csvFilesAdded.current.add(fname); // prevent re-adding
  //           await handleDrop([new File([content], fname)]);
  //         }
  //       }
  //     }
  //   })();
  // }, [csvFiles]);

  // const {getRootProps, getInputProps, isDragActive} = useDropzone({
  //   onDrop: handleDrop,
  //   accept: ACCEPTED_FORMATS,
  //   // maxFiles: 1,
  //   multiple: true,
  // });

  const {getRootProps, getInputProps, isDragActive, open} = useDropzone({
    onDrop,
    accept: ACCEPTED_FORMATS,
    // maxFiles: 1,
    multiple,
    // Disable click and keydown behavior
    noClick: true,
    noKeyboard: true,
  });

  const borderColor = isInvalid
    ? 'tomato'
    : isDragActive
      ? 'gray.100'
      : 'gray.500';

  const handleClick = (): void => {
    open();
  };
  // if (loadingStatus) {
  //   return (
  //     <SpinnerPane h="100%">
  //       <Text fontSize="sm" color="gray.500">
  //         {loadingStatus}
  //       </Text>
  //     </SpinnerPane>
  //   );
  // }
  return (
    <Flex
      // minWidth={"300px"}
      direction={'column'}
      color={isDragActive ? 'gray.100' : 'gray.400'}
      bg={isDragActive ? 'gray.600' : 'transparent'}
      // p={5}
      py={2}
      cursor="pointer"
      // bg={'gray.700'}
      // _hover={{bg: 'gray.700'}}
      transition="background-color 0.2s ease, border-color 0.2s ease"
      // borderRadius="sm"
      // border={`2px dashed`}
      border="none"
      background={borderBackground}
      // borderColor="gray.300"
      overflow="hidden"
      borderColor={borderColor}
      {...getRootProps()}
      position={'relative'}
      height={'100%'}
      onClick={handleClick}
      _hover={{borderColor: 'gray.100'}}
      {...rest}
    >
      <>
        <input {...getInputProps()} />
        <Flex
          gap={2}
          direction={'column'}
          position={'relative'}
          height={'100%'}
        >
          {/* <Box
            position={'absolute'}
            width={'100%'}
            height={'100%'}
            overflow={'auto'}
          >
            {tables?.length ? (
              <VStack gap={2}>
                {tables.map((table, i) => (
                  <FileCard key={i} onReset={handleReset} value={table} />
                ))}
              </VStack>
            ) : null}
          </Box> */}
          <Flex
            direction={'column'}
            height={'100%'}
            alignItems={'center'}
            justifyContent={'center'}
            // color={'gray.500'}
            gap={2}
          >
            <HStack>
              <Icon w={6} h={6} as={DocumentPlusIcon} />
              <Text fontSize={'sm'}>
                {isDragActive ? 'Drop here ...' : 'Drop files here'}
              </Text>
            </HStack>
            <Flex flexWrap={'wrap'} gap={2} justifyContent={'center'}>
              <Text fontSize="xs" fontWeight="bold">
                Supported formats:
              </Text>
              <Text fontSize="xs">
                {Object.values(ACCEPTED_FORMATS).flat().join(', ')}
              </Text>
            </Flex>
          </Flex>
        </Flex>
      </>
    </Flex>
  );
};

export default FileDropzone;
