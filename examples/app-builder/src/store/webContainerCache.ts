import {WebContainer} from '@webcontainer/api';

/**
 * Cache WebContainer instance and server URL on window to survive HMR.
 * WebContainer only allows a single instance to be booted.
 */
declare global {
  interface Window {
    __webContainerInstance?: WebContainer;
    __webContainerServerUrl?: string;
  }
}

export function getCachedWebContainer(): WebContainer | undefined {
  return typeof window !== 'undefined'
    ? window.__webContainerInstance
    : undefined;
}

export function setCachedWebContainer(instance: WebContainer): void {
  if (typeof window !== 'undefined') {
    window.__webContainerInstance = instance;
  }
}

export function getCachedServerUrl(): string | undefined {
  return typeof window !== 'undefined'
    ? window.__webContainerServerUrl
    : undefined;
}

export function setCachedServerUrl(url: string): void {
  if (typeof window !== 'undefined') {
    window.__webContainerServerUrl = url;
  }
}
