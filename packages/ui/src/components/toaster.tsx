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
