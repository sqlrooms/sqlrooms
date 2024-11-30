import {SearchIcon} from '@chakra-ui/icons';
import {
  Box,
  Center,
  CloseButton,
  Flex,
  Grid,
  Heading,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Spacer,
  Stack,
  Text,
} from '@chakra-ui/react';
import React, {KeyboardEventHandler, useMemo, useState} from 'react';

import {
  ErrorPane,
  SkeletonPane,
  matchesSearchQuery,
  matchesSearchWords,
  splitIntoWords,
} from '@sqlrooms/components';
import type {UseQueryResult} from '@tanstack/react-query';

type Props<T> = {
  title: string;
  description: string;
  query: UseQueryResult<T[] | undefined>;
  getSearchString: (item: T) => string;
  renderItem: (item: T, onChange: () => void) => JSX.Element;
  actionButtons?: JSX.Element;
  emptyState?: JSX.Element | string;
};
function SearchableGrid<T>(props: Props<T>): JSX.Element {
  const {
    title,
    description,
    query,
    getSearchString,
    renderItem,
    actionButtons,
    emptyState,
  } = props;
  const {isFetching, data: items, error, refetch} = query;

  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleClearSearchQuery = () => {
    setSearchQuery('');
  };

  const handleSearchKeyDown: KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.code === 'Escape') handleClearSearchQuery();
  };

  const filteredItems = useMemo(() => {
    const searchWords = splitIntoWords(searchQuery);
    return searchWords
      ? items?.filter((item) =>
          matchesSearchWords(searchWords, getSearchString(item)),
        )
      : items;
  }, [getSearchString, items, searchQuery]);

  return (
    <>
      <Flex
        direction="column"
        as="section"
        margin="auto"
        maxW="7xl"
        px={10}
        pt={5}
        height={'100vh'}
        overflow={'hidden'}
        gap={10}
      >
        <Flex flexDirection={'column'} gap={2} mt={8}>
          <Heading size="xl" color="white">
            {title}
          </Heading>
          <Text
          //  my="3" fontSize="md" color="gray.600"
          >
            {description}
          </Text>
        </Flex>

        <Flex alignSelf="stretch" alignItems="center" gap={2} pr="2">
          <Box>{actionButtons}</Box>
          <Spacer />
          <Stack>
            <InputGroup>
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.600" />
              </InputLeftElement>
              <Input
                value={searchQuery}
                onKeyDown={handleSearchKeyDown}
                onChange={handleSearchQueryChange}
              />
              <InputRightElement>
                <CloseButton
                  variant="ghost"
                  isDisabled={!searchQuery.length}
                  onClick={handleClearSearchQuery}
                />
              </InputRightElement>
            </InputGroup>
          </Stack>
        </Flex>
        <Flex
          direction={'column'}
          gap={20}
          flexGrow={1}
          overflow={'auto'}
          pr="2"
        >
          {isFetching && !items?.length ? (
            <SkeletonPane h={200} n={5} />
          ) : error ? (
            <ErrorPane error={error} />
          ) : (
            <Flex
              flexGrow={1}
              width={'100%'}
              height={'100%'}
              justifyContent={'center'}
            >
              <Flex flexDir="column" gap={20} flexGrow="1">
                {!isFetching && !error && !items?.length ? (
                  <Center mt={100}>
                    <Text fontSize="lg">{emptyState ?? 'No items'}</Text>
                  </Center>
                ) : null}

                {items?.length ? (
                  filteredItems?.length ? (
                    // <SimpleGrid
                    //   columns={
                    //     filteredItems.length < 3
                    //       ? filteredItems.length
                    //       : {md: 2, lg: 3}
                    //   }
                    //   spacing="40px"
                    //   alignSelf={'stretch'}
                    //   pb={10}
                    // >
                    <Grid
                      pb={10}
                      templateColumns={{
                        xl: 'repeat(4, 1fr)',
                        lg: 'repeat(3, 1fr)',
                        md: 'repeat(2, 1fr)',
                        sm: 'repeat(1, 1fr)',
                      }}
                      columnGap={'20px'}
                      rowGap={'20px'}
                    >
                      {' '}
                      {filteredItems.map((item, idx) => (
                        <React.Fragment key={idx}>
                          {renderItem(item, () => refetch())}
                        </React.Fragment>
                      ))}
                    </Grid>
                  ) : (
                    <Box>
                      <Center width="100%">
                        <Text fontSize="lg">No matches found</Text>
                      </Center>
                    </Box>
                  )
                ) : null}
              </Flex>
            </Flex>
          )}
        </Flex>
      </Flex>
    </>
  );
}

export default SearchableGrid;
