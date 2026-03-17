'use client';

import {Toaster as Sonner, type ToasterProps} from 'sonner';
import {useTheme} from '../theme/theme-provider';
import type {CSSProperties} from 'react';


const Toaster = ({...props}: ToasterProps) => {
  const {theme = 'system'} = useTheme();

  return (
    <Sonner
      richColors
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      closeButton={true}
      icons={{
        success: null,
        info: null,
        warning: null,
        error: null,
        loading: null,
      }}
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
          toast: 'cn-toast relative',
          closeButton:
            'absolute top-2 right-2 z-10 cursor-pointer text-muted-foreground hover:text-foreground',
        },
        cancelButtonStyle: {
          position: 'absolute',
          top: '10px',
          right: '10px',
        },
      }}
      {...props}
    />
  );
};

export {Toaster};
