import {toast} from 'sonner';
import type {ExternalToast} from 'sonner';

const DEFAULT_DURATION = 5000;

export function useToast() {
  return {
    toast: (message: string, options?: ExternalToast) =>
      toast(message, {duration: DEFAULT_DURATION, ...options}),
    success: (message: string, options?: ExternalToast) =>
      toast.success(message, {duration: DEFAULT_DURATION, ...options}),
    error: (message: string, options?: ExternalToast) =>
      toast.error(message, {duration: DEFAULT_DURATION, ...options}),
    warning: (message: string, options?: ExternalToast) =>
      toast.warning(message, {duration: DEFAULT_DURATION, ...options}),
    info: (message: string, options?: ExternalToast) =>
      toast.info(message, {duration: DEFAULT_DURATION, ...options}),
    promise: <T>(
      promise: Promise<T>,
      options: {
        loading: string;
        success: string | ((data: T) => string);
        error: string | ((error: unknown) => string);
      },
    ) =>
      toast.promise(promise, {
        ...options,
        duration: DEFAULT_DURATION,
      }),
  };
}
