import {CheckIcon, CloseIcon, EditIcon, WarningTwoIcon} from '@chakra-ui/icons';
import {
  ButtonGroup,
  Editable,
  EditableInput,
  EditablePreview,
  EditableProps,
  Flex,
  Icon,
  IconButton,
  Input,
  Spinner,
  Tooltip,
  useEditableControls,
} from '@chakra-ui/react';
import {FC, useEffect, useState} from 'react';

type Props = {
  value: string;
  onChange: (value: string) => string | undefined;
  onValidate?: (value: string) => {success: boolean; error?: Error};
  isLoading?: boolean;
  error?: any;
} & EditableProps;

const EditableControls: FC<{
  isDisabled?: boolean;
  isValid: boolean;
  onStopEditing: () => void;
}> = ({isDisabled, isValid, onStopEditing}) => {
  const {
    isEditing,
    getSubmitButtonProps,
    getCancelButtonProps,
    getEditButtonProps,
  } = useEditableControls();

  useEffect(() => {
    if (!isEditing) {
      onStopEditing();
    }
  }, [isEditing]);

  // return null;
  return isEditing ? (
    <ButtonGroup justifyContent="center" size="sm">
      <IconButton
        size="xs"
        icon={<CheckIcon />}
        {...getSubmitButtonProps()}
        aria-label="Confirm"
      />
      <IconButton
        size="xs"
        icon={<CloseIcon />}
        {...getCancelButtonProps()}
        aria-label="Close"
      />
    </ButtonGroup>
  ) : !isDisabled ? (
    <Flex justifyContent="center">
      <IconButton
        size="xs"
        variant="ghost"
        colorScheme={isValid ? 'gray' : 'red'}
        icon={<EditIcon />}
        {...getEditButtonProps()}
        aria-label="Edit"
      />
    </Flex>
  ) : null;
};

const Preview: FC<{
  value: string;
  maxWidth: EditableProps['maxWidth'];
}> = ({maxWidth}) => {
  return (
    // <Tooltip
    //   hasArrow
    //   placement="bottom"
    //   label={value}
    //   openDelay={2000}
    //   isOpen={isEditing ? false : undefined}
    // >
    <EditablePreview
      whiteSpace="nowrap"
      maxWidth={maxWidth}
      textOverflow="ellipsis"
      overflow="hidden"
      px="7px"
      py="3.5px"
      borderRadius={2}
      border={'2px solid transparent'}
      _hover={{
        borderColor: 'gray.600',
      }}
    />
    // </Tooltip>
  );
};

const EditableText: FC<Props> = (props) => {
  const {
    value,
    isLoading,
    isDisabled,
    error,
    width = '400px',
    onChange,
    onValidate,
    ...rest
  } = props;
  const {fontSize, maxWidth} = rest;
  const [isValid, setIsValid] = useState(true);
  const [internalValue, setInternalValue] = useState(value);

  useEffect(() => {
    setInternalValue(value);
    if (onValidate) {
      const {success} = onValidate(value);
      setIsValid(success);
    }
  }, [value]);
  return (
    <Editable
      textAlign="center"
      defaultValue={value}
      isPreviewFocusable={true}
      {...rest}
      isDisabled={isDisabled}
      value={internalValue}
      onChange={setInternalValue}
    >
      <Flex gap={1} alignItems="center">
        <Preview maxWidth={maxWidth} value={internalValue} />
        <Input
          as={EditableInput}
          fontSize={fontSize}
          px="8px"
          py="6px"
          size="sm"
          // w={'auto'}
          width={width}
        />
        {isLoading ? (
          <Spinner color="gray.400" size="xs" ml={2} />
        ) : (
          <>
            <EditableControls
              isValid={isValid}
              isDisabled={isDisabled}
              onStopEditing={() => {
                if (!isLoading && !error && internalValue !== value) {
                  const nextName = onChange(internalValue);
                  if (typeof nextName === 'string') {
                    setInternalValue(nextName);
                  }
                }
              }}
            />
            {error ? (
              <Tooltip
                hasArrow
                placement="bottom"
                label={`Error: ${error.message}`}
                backgroundColor="error"
              >
                <Icon as={WarningTwoIcon} color={'error'} />
              </Tooltip>
            ) : null}
          </>
        )}
      </Flex>
    </Editable>
  );
};

export default EditableText;
