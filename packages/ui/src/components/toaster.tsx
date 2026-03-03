'use client';

import {Toaster as Sonner, type ToasterProps} from 'sonner';

import {useTheme} from '../theme/theme-provider';
import {LegacyToaster} from './toaster-legacy';

export function Toaster(props: ToasterProps) {
  const {theme} = useTheme();

  return (
    <>
      <LegacyToaster />
      <Sonner
        theme={theme as ToasterProps['theme']}
        className="toaster group"
        toastOptions={{
          classNames: {
            toast:
              'group toast group-[.toaster]:border-border group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:shadow-lg',
            description: 'group-[.toast]:text-muted-foreground',
            actionButton:
              'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
            cancelButton:
              'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          },
        }}
        {...props}
      />
    </>
  );
}
