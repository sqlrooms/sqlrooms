import {FC, useEffect} from 'react';
import {FormProvider, useForm, UseFormReturn} from 'react-hook-form';
import {
  Button,
  cn,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from '@sqlrooms/ui';
import {SettingsIcon} from 'lucide-react';

import {TextConfig} from './TextConfig';
import {DropdownConfig} from './DropdownConfig';
import {initializeParameter} from '../../../NotebookUtils';
import {ParameterTypes, ParameterUnion} from '../../../cellSchemas';
import {SliderConfig} from './SliderConfig';

type Props = {
  className?: string;
  input: ParameterUnion;
  updateInput: (patch: ParameterUnion) => void;
};

export const ParameterConfigPanel: FC<Props> = ({
  className,
  input,
  updateInput,
}) => {
  const methods = useForm<ParameterUnion>({
    defaultValues: input,
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const {
    handleSubmit,
    reset,
    formState: {isSubmitting, errors},
  } = methods;

  // Keep form in sync when `input` prop changes externally
  useEffect(() => {
    reset(input);
  }, [input, reset]);

  const onSubmit = (data: ParameterUnion) => {
    if (data.kind === 'dropdown' && !data.value && data.options.length > 0) {
      const newValue = data.options[0] ?? '';
      updateInput({...data, value: newValue});
      return;
    } else if (data.kind === 'slider') {
      const clampedValue = Math.min(Math.max(data.value, data.min), data.max);
      updateInput({...data, value: clampedValue});
      return;
    }

    updateInput(data);
  };

  const onInteractOutside = (e: {preventDefault: () => void}) => {
    if (Object.keys(errors).length > 0) {
      e.preventDefault();
      return;
    }
    handleSubmit(onSubmit)();
  };

  return (
    <div className={cn(className)}>
      <FormProvider {...methods}>
        <Popover>
          <PopoverTrigger asChild>
            {isSubmitting ? (
              <Spinner />
            ) : (
              <SettingsIcon
                size={18}
                strokeWidth={1.5}
                className="cursor-pointer"
              />
            )}
          </PopoverTrigger>
          <PopoverContent
            className="flex flex-col gap-5"
            onInteractOutside={onInteractOutside}
          >
            <form className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input
                  className="h-8 text-sm"
                  {...methods.register('varName')}
                />
              </div>

              <ParameterTypeDropdown methods={methods} />

              <ParameterConfig methods={methods} />
            </form>
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="w-full border-red-500 text-red-500 hover:bg-red-500/10 hover:text-red-600"
            >
              Remove parameter
            </Button>
          </PopoverContent>
        </Popover>
      </FormProvider>
    </div>
  );
};

const ParameterConfig: FC<{methods: UseFormReturn<ParameterUnion>}> = ({
  methods,
}) => {
  const draftInput = methods.watch();
  switch (draftInput.kind) {
    case 'text':
      return <TextConfig />;
    case 'slider':
      return <SliderConfig />;
    case 'dropdown':
      return <DropdownConfig />;
  }
};

const ParameterTypeDropdown: FC<{methods: UseFormReturn<ParameterUnion>}> = ({
  methods,
}) => {
  const {watch, reset, getValues, trigger} = methods;
  const kind = watch('kind');

  const onTypeChange = (kind: ParameterTypes) => {
    const newParameter = initializeParameter(kind, getValues());
    reset(newParameter, {keepErrors: false});
    trigger();
  };

  return (
    <div className="flex flex-col gap-2">
      <Label>Type</Label>
      <Select value={kind} onValueChange={onTypeChange}>
        <SelectTrigger className="h-8 shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
          {ParameterTypes.options.map((option) => (
            <SelectItem className="text-xs" key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
