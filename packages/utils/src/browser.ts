/**
 * Function to detect if the user is on a Mac device
 * @returns boolean indicating if the user is on a Mac
 */
type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    platform?: string;
  };
};

export function isMacOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const {platform, userAgentData} = navigator as NavigatorWithUserAgentData;
  return /mac/i.test(userAgentData?.platform ?? platform ?? '');
}
