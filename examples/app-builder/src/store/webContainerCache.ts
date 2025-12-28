import {WebContainer} from '@webcontainer/api';

/**
 * Cache WebContainer instance and server URL on window to survive HMR.
 * WebContainer only allows a single instance to be booted.
 */
declare global {
  interface Window {
    __webContainerInstance?: WebContainer;
    __webContainerServerUrl?: string;
    __webContainerBootPromise?: Promise<WebContainer>;
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

/**
 * Boot WebContainer or return existing/in-progress boot.
 * Prevents multiple concurrent boot attempts.
 */
export async function bootWebContainer(): Promise<WebContainer> {
  if (typeof window === 'undefined') {
    throw new Error('WebContainer can only be booted in browser');
  }

  // Return existing instance
  if (window.__webContainerInstance) {
    return window.__webContainerInstance;
  }

  // Wait for in-progress boot
  if (window.__webContainerBootPromise) {
    return window.__webContainerBootPromise;
  }

  // Start new boot and cache the promise
  window.__webContainerBootPromise = WebContainer.boot().then((instance) => {
    window.__webContainerInstance = instance;
    return instance;
  });

  return window.__webContainerBootPromise;
}
