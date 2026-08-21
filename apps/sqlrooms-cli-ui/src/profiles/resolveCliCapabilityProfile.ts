import {DEFAULT_CLI_CAPABILITY_PROFILE} from './defaultProfile';
import {EXPERIMENTAL_CLI_CAPABILITY_PROFILE} from './experimentalProfile';
import {WORKSHEET_CHARTS_MAPS_CLI_CAPABILITY_PROFILE} from './worksheetChartsMapsProfile';
import {
  CLI_CAPABILITY_PROFILE_NAMES,
  type CliCapabilityProfile,
  type CliCapabilityProfileName,
} from './types';

const CLI_CAPABILITY_PROFILES = {
  default: DEFAULT_CLI_CAPABILITY_PROFILE,
  experimental: EXPERIMENTAL_CLI_CAPABILITY_PROFILE,
  'worksheet-charts-maps': WORKSHEET_CHARTS_MAPS_CLI_CAPABILITY_PROFILE,
} as const satisfies Record<CliCapabilityProfileName, CliCapabilityProfile>;

export type ResolveCliCapabilityProfileOptions = {
  /** Named profile supplied by the Python runtime. */
  profileName?: string;
  /** Compatibility field emitted by older Python runtimes. */
  experimentalEnabled?: boolean;
};

/** Resolves and validates the production CLI capability profile. */
export function resolveCliCapabilityProfile({
  profileName,
  experimentalEnabled = false,
}: ResolveCliCapabilityProfileOptions = {}): CliCapabilityProfile {
  const normalizedName = profileName?.trim();
  if (
    profileName !== undefined &&
    !CLI_CAPABILITY_PROFILE_NAMES.includes(
      normalizedName as CliCapabilityProfileName,
    )
  ) {
    throw new Error(
      `Unknown SQLRooms capability profile "${normalizedName}". Expected one of: ${CLI_CAPABILITY_PROFILE_NAMES.join(', ')}.`,
    );
  }

  if (
    experimentalEnabled &&
    normalizedName &&
    normalizedName !== 'experimental'
  ) {
    throw new Error(
      `Conflicting SQLRooms capability configuration: profile "${normalizedName}" cannot be combined with experimentalEnabled.`,
    );
  }

  const resolvedName = (
    profileName === undefined
      ? experimentalEnabled
        ? 'experimental'
        : 'default'
      : normalizedName
  ) as CliCapabilityProfileName;
  return CLI_CAPABILITY_PROFILES[resolvedName];
}

/** Returns all built-in production profiles in stable display order. */
export function listCliCapabilityProfiles(): readonly CliCapabilityProfile[] {
  return CLI_CAPABILITY_PROFILE_NAMES.map(
    (profileName) => CLI_CAPABILITY_PROFILES[profileName],
  );
}
