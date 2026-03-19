'use client';

import {Toaster as Sonner, type ToasterProps} from 'sonner';
import {useTheme} from '../theme/theme-provider';
import type {CSSProperties, ReactNode} from 'react';

interface CustomToasterProps extends ToasterProps {
  closeButton?: boolean;
  icons?: {
    success?: ReactNode;
    error?: ReactNode;
    warning?: ReactNode;
    info?: ReactNode;
  };
}

const Toaster = ({
  closeButton = false,
  icons,
  ...props
}: CustomToasterProps) => {
  const {theme = 'system'} = useTheme();

  return (
    <Sonner
      richColors
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      closeButton={closeButton}
      icons={icons}
      style={
        {
          '--normal-bg': 'var(--color-popover)',
          '--normal-text': 'var(--color-popover-foreground)',
          '--normal-border': 'var(--color-border)',

          '--success-bg': 'var(--color-popover)',
          '--success-text': 'var(--color-popover-foreground)',
          '--success-border': 'var(--color-border)',

          '--info-bg': 'var(--color-popover)',
          '--info-text': 'var(--color-popover-foreground)',
          '--info-border': 'var(--color-border)',

          '--warning-bg': 'var(--color-popover)',
          '--warning-text': 'var(--color-popover-foreground)',
          '--warning-border': 'var(--color-border)',

          '--error-bg': 'var(--color-destructive)',
          '--error-text': 'var(--color-destructive-foreground)',
          '--error-border': 'var(--color-destructive)',

          '--border-radius': 'var(--radius)',
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'cn-toast',
        },
      }}
      {...props}
    />
  );
};

export {Toaster};
