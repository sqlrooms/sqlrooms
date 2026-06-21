type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    platform?: string;
  };
};

/**
 * Detects whether the current browser platform is macOS.
 *
 * Uses User-Agent Client Hints when available and falls back to the legacy
 * navigator platform string. Returns false outside browser environments.
 *
 * @returns True when the current platform appears to be macOS.
 */
export function isMacOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const {platform, userAgentData} = navigator as NavigatorWithUserAgentData;
  return /mac/i.test(userAgentData?.platform ?? platform ?? '');
}
