import {Input, Label} from '@sqlrooms/ui';
import {useFormContext} from 'react-hook-form';

export const SliderConfig = () => {
  const {register} = useFormContext();
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label>
          Min <span className="text-gray-500">(number)</span>
        </Label>
        <Input type="number" {...register('min')} />
      </div>

      <div className="flex flex-col gap-2">
        <Label>
          Max <span className="text-gray-500">(number)</span>
        </Label>
        <Input type="number" {...register('max')} />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Step</Label>
        <Input type="number" {...register('step')} />
      </div>
    </>
  );
};
