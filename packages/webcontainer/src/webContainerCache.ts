import {WebContainer} from '@webcontainer/api';

/**
 * Cache WebContainer instance and server URL on window to survive HMR.
 * WebContainer only allows a single instance to be booted.
 */
declare global {
  interface Window {
    __webContainersInstance?: WebContainer;
    __webContainersServerUrl?: string;
    __webContainersBootPromise?: Promise<WebContainer>;
  }
}

export function getCachedWebContainer(): WebContainer | undefined {
  return typeof window !== 'undefined'
    ? window.__webContainersInstance
    : undefined;
}

export function setCachedWebContainer(instance: WebContainer): void {
  if (typeof window !== 'undefined') {
    window.__webContainersInstance = instance;
  }
}

export function getCachedWebContainerServerUrl(): string | undefined {
  return typeof window !== 'undefined'
    ? window.__webContainersServerUrl
    : undefined;
}

export function setCachedWebContainerServerUrl(url: string): void {
  if (typeof window !== 'undefined') {
    window.__webContainersServerUrl = url;
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
  if (window.__webContainersInstance) {
    return window.__webContainersInstance;
  }

  // Wait for in-progress boot
  if (window.__webContainersBootPromise) {
    return window.__webContainersBootPromise;
  }

  // Start new boot and cache the promise
  window.__webContainersBootPromise = WebContainer.boot().then((instance) => {
    window.__webContainersInstance = instance;
    return instance;
  });

  return window.__webContainersBootPromise;
}
