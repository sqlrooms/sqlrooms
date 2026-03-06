'use client';

import {Toaster as Sonner, type ToasterProps} from 'sonner';

import {useTheme} from '../theme/theme-provider';
import {useToast} from '../hooks/use-toast';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from './toast';
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';

function LegacyToaster() {
  const {toasts} = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({id, title, description, action, ...props}) {
        return (
          <Toast key={id} {...props}>
            <div className="grid w-full gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}

export const Toaster = ({...props}: ToasterProps) => {
  const {theme = 'system'} = useTheme();

  return (
    <Sonner
      richColors
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
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
        } as React.CSSProperties
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
