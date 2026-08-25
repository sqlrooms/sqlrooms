import {fetchRuntimeConfig, resolveCliDevProxyConfig} from './runtimeConfig';
import {resolveCliCapabilityProfile} from './profiles';

const fetchedRuntimeConfig = await fetchRuntimeConfig();

/** Runtime configuration loaded once during CLI UI startup. */
export const runtimeConfig = import.meta.env.DEV
  ? resolveCliDevProxyConfig(fetchedRuntimeConfig, globalThis.location.href, {
      proxyWebSockets:
        import.meta.env.VITE_SQLROOMS_CLI_PROXY_WEBSOCKETS === 'true',
    })
  : fetchedRuntimeConfig;

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
