import {Box, Flex, Skeleton, Stack, useInterval} from '@chakra-ui/react';
import React from 'react';
import {StackProps} from '@chakra-ui/layout';

export type Props = {
  n?: number;
  staggeringDelay?: number;
  rowHeight?: number | string;
} & StackProps;

const SkeletonPane: React.FC<Props> = (props) => {
  const {n = 3, staggeringDelay = 200, rowHeight = '20px', ...rest} = props;
  const [count, setCount] = React.useState(0);

  useInterval(
    () => {
      setCount(count + 1);
    },
    count < n ? staggeringDelay : null,
  );

  return (
    <Flex direction="column" width="100%" justifyContent="center" {...rest}>
      <Stack gap={2}>
        {Array.from({length: n}).map((_, i) =>
          i < count ? (
            <Skeleton key={i} height={rowHeight} />
          ) : (
            <Box key={i} height={rowHeight} />
          ),
        )}
      </Stack>
    </Flex>
  );
};

export default SkeletonPane;
