/**
 * Function to detect if the user is on a Mac device
 * @returns boolean indicating if the user is on a Mac
 */
export function isMacOS(): boolean {
  return navigator.platform.toLowerCase().includes('mac');
}
