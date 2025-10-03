import {Input, Label} from '@sqlrooms/ui';
import {OctagonAlertIcon} from 'lucide-react';
import {useFormContext} from 'react-hook-form';

export const SliderConfig = () => {
  const {
    register,
    formState: {errors},
  } = useFormContext();

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Label>Min</Label>
          <Label>Max</Label>

          <Input
            type="number"
            className="h-8 text-sm"
            {...register('min', {
              valueAsNumber: true,
              validate: (v, formValues) =>
                v <= formValues.max || 'Min should not exceed Max',
            })}
          />

          <Input
            type="number"
            className="h-8 text-sm"
            {...register('max', {
              valueAsNumber: true,
              validate: (v, formValues) =>
                v >= formValues.min || 'Max should not be less than Min',
            })}
          />
        </div>
        {errors.min && (
          <span className="flex items-center gap-1 text-xs text-red-500">
            <OctagonAlertIcon size={16} strokeWidth={1.5} />
            {String(errors.min.message)}
          </span>
        )}
        {errors.max && (
          <span className="flex items-center gap-1 text-xs text-red-500">
            <OctagonAlertIcon size={16} strokeWidth={1.5} />
            {String(errors.max.message)}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label>Step</Label>
        <Input
          type="number"
          className="h-8 text-sm"
          min={0}
          {...register('step', {
            valueAsNumber: true,
            validate: (v) => v > 0 || 'Step must be greater than 0',
          })}
        />
        {errors.step && (
          <span className="flex items-center gap-1 text-xs text-red-500">
            <OctagonAlertIcon size={16} strokeWidth={1.5} />
            {String(errors.step.message)}
          </span>
        )}
      </div>
    </>
  );
};
