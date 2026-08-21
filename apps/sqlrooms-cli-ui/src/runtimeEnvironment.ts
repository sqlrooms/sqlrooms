import {fetchRuntimeConfig} from './runtimeConfig';
import {resolveCliCapabilityProfile} from './profiles';

/** Runtime configuration loaded once during CLI UI startup. */
export const runtimeConfig = await fetchRuntimeConfig();

/** Whether AI development tools are enabled for this runtime. */
export const aiDevtoolsEnabled =
  import.meta.env.DEV || Boolean(runtimeConfig.aiDevtools);

/** Production capability profile selected for this runtime. */
export const cliCapabilityProfile = resolveCliCapabilityProfile({
  profileName: runtimeConfig.capabilityProfile,
  experimentalEnabled: runtimeConfig.experimentalEnabled,
});

/** @deprecated Prefer cliCapabilityProfile. */
export const experimentalEnabled = cliCapabilityProfile.name === 'experimental';
