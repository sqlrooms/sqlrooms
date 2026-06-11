'use client';

import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';

import {cn} from '../lib/utils';

const SwitchRoot = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
    children?: React.ReactNode;
  }
>(({className, children, ...props}, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      'focus-visible:ring-ring focus-visible:ring-offset-background data-[state=checked]:bg-primary data-[state=unchecked]:bg-input peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
    ref={ref}
  >
    {children ?? <SwitchPrimitives.Thumb />}
  </SwitchPrimitives.Root>
));
SwitchRoot.displayName = SwitchPrimitives.Root.displayName;

const SwitchThumb = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitives.Thumb>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Thumb>
>(({className, ...props}, ref) => (
  <SwitchPrimitives.Thumb
    className={cn(
      'bg-background pointer-events-none block h-4 w-4 rounded-full shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
      className,
    )}
    {...props}
    ref={ref}
  />
));
SwitchThumb.displayName = SwitchPrimitives.Thumb.displayName;

const Switch = Object.assign(SwitchRoot, {
  Thumb: SwitchThumb,
});

export {Switch};
