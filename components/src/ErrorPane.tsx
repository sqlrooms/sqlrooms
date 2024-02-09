import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Flex,
  FlexProps,
  Text,
} from '@chakra-ui/react';
import {ArrowPathIcon} from '@heroicons/react/24/solid';
import {FC} from 'react';

type Props = {
  embed?: boolean;
  error?: string | Error | any;
  title?: string;
  text?: string;
  onRetry?: () => void;
  onGoToStart?: () => void;
  actions?: boolean;
};
const ErrorPane: FC<Props & Partial<FlexProps>> = ({
  embed,
  title = 'Something went wrong',
  //error,
  text = `We are sorry, but something unexpected happened. We were notified
          and will be working on resolving the issue as soon as possible.`,
  onRetry,
  actions = false,
  onGoToStart,
  ...rest
}) => {
  return (
    <Flex justifyContent="center" {...rest}>
      <Alert
        status={'error'}
        variant="subtle"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        textAlign="center"
        minHeight={200}
        //minWidth={embed ? undefined : 350}
        maxWidth={450}
        borderRadius={8}
        pt={6}
        backgroundColor="gray.700"
      >
        <AlertIcon boxSize="30px" mr={0} color={'error'} />
        <AlertTitle mt={4} mb={1} fontSize="xl">
          {title}
        </AlertTitle>

        <AlertDescription maxWidth="sm" mt={3} px={2}>
          <Text mb={5} textAlign="left">
            {text}
          </Text>
          {actions ? (
            <Box mt={6} mb={3}>
              <Flex gap={2} justifyContent="center">
                {onRetry ? (
                  <Button
                    size="sm"
                    onClick={onRetry /*?? router.reload*/}
                    leftIcon={<ArrowPathIcon width={18} height={18} />}
                  >
                    Retry
                    {/* {onRetry ? 'Retry' : 'Reload page'} */}
                  </Button>
                ) : null}
                {embed ? null : onGoToStart ? (
                  <Button
                    onClick={onGoToStart /*?? (() => router.push('/'))*/}
                    size="sm"
                  >
                    Go to start page
                  </Button>
                ) : null}
              </Flex>
            </Box>
          ) : null}
        </AlertDescription>
      </Alert>
    </Flex>
  );
};

export default ErrorPane;
