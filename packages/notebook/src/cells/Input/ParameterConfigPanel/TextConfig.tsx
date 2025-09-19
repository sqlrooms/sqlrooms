import {Input, Label} from '@sqlrooms/ui';
import {useFormContext} from 'react-hook-form';

export const TextConfig = () => {
  const {register} = useFormContext();

  return (
    <>
      <Label>Value</Label>
      <Input className="h-8" {...register('value')} />
    </>
  );
};
