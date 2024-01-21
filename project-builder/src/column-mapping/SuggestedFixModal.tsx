import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  Heading,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  UseDisclosureReturn,
  useTheme,
} from '@chakra-ui/react';
import {AppContext} from '@flowmapcity/components';
import {DuckQueryError} from '@flowmapcity/duckdb';
import {FC, FormEvent, useCallback, useContext} from 'react';
import {FieldError, useForm} from 'react-hook-form';
import {BsMagic} from 'react-icons/bs';
import {useProjectStore} from '../ProjectStateProvider';
import {SuggestedFix} from '../types';

type Props = {
  problemDescription: string;
  suggestedFix: SuggestedFix;
  disclosure: UseDisclosureReturn;
};

type FormData = {
  formError?: string;
};

const SuggestedFixModal: FC<Props> = (props) => {
  const {problemDescription, suggestedFix, disclosure} = props;
  const theme = useTheme();

  const {handleSubmit, formState, setError, clearErrors} = useForm<FormData>({
    values: {},
  });
  const {errors, isSubmitting} = formState;
  const addSqlQuery = useProjectStore((state) => state.addSqlQuery);
  const getViewStore = useProjectStore((state) => state.getViewStore);

  const onSubmit = useCallback(
    (ev: FormEvent<HTMLFormElement>) => {
      clearErrors('formError');
      handleSubmit(async () => {
        try {
          for (const query of suggestedFix.queries) {
            await addSqlQuery(query.tableName, query.query);
          }
          if (suggestedFix.updateViewConfig) {
            const {viewId, update} = suggestedFix.updateViewConfig;
            const store = getViewStore(viewId);
            if (store) {
              const {config} = store.getState();
              store.setState({config: update(config)});
            }
          }
          disclosure.onClose();
        } catch (err) {
          setError('formError', {
            type: 'manual',
            message:
              err instanceof DuckQueryError
                ? err.getMessageForUser()
                : `${err}`,
          });
        }
      })(ev);
    },
    [
      clearErrors,
      handleSubmit,
      suggestedFix.updateViewConfig,
      suggestedFix.queries,
      disclosure,
      addSqlQuery,
      getViewStore,
      setError,
    ],
  );
  const appContext = useContext(AppContext);
  return (
    <Modal
      isCentered
      size="lg"
      isOpen={disclosure.isOpen}
      onClose={disclosure.onClose}
      closeOnOverlayClick={false}
      preserveScrollBarGap={appContext.mode === 'sdk'} // to avoid layout jumping and CSS added to host document
    >
      <ModalOverlay backdropFilter={theme.backdropFilter} />
      <ModalContent>
        <form onSubmit={onSubmit}>
          <ModalHeader display="flex" alignItems="center" gap="2" flexDir="row">
            <BsMagic width={16} height={16} />
            Apply suggested fix
            {/* <Text fontSize="xs" color="gray.300" fontWeight="normal">
              Create a new table from the results of an SQL query.
            </Text> */}
          </ModalHeader>
          <ModalBody display="flex" flexDir="column" gap="6">
            <FormControl isInvalid={Boolean(errors.formError)}>
              <FormErrorMessage>
                <Alert status="error" borderRadius={4} mb={6}>
                  <AlertIcon />
                  <AlertDescription fontSize="sm">
                    {(errors.formError as FieldError)?.message}
                  </AlertDescription>
                </Alert>
              </FormErrorMessage>
            </FormControl>

            <Flex flexDir="column" gap="2">
              <Heading
                fontSize="sm"
                color="gray.400"
                fontWeight="bold"
                textTransform="uppercase"
              >
                Problem description
              </Heading>
              <Text fontSize="sm">{problemDescription}</Text>
            </Flex>
            <Flex flexDir="column" gap="2">
              <Heading
                fontSize="sm"
                color="gray.400"
                fontWeight="bold"
                textTransform="uppercase"
              >
                Suggested fix
              </Heading>
              <Text fontSize="sm">{suggestedFix.description}</Text>
            </Flex>

            <Flex flexDir="column" gap="2">
              <Text
                fontSize="sm"
                // color="gray.400"
                // fontWeight="bold"
                // textTransform="uppercase"
              >
                This will create the following new tables:
              </Text>
              <Box bg="gray.800" p="2">
                {suggestedFix.queries.map((query, index) => (
                  <Text fontSize="xs" fontFamily="mono" key={index}>
                    {query.tableName}
                  </Text>
                ))}
              </Box>
            </Flex>
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={disclosure.onClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              mr={3}
              type="submit"
              isLoading={isSubmitting}
            >
              Apply
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

export default SuggestedFixModal;
