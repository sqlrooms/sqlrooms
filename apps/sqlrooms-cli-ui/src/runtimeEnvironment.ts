import {fetchRuntimeConfig} from './runtimeConfig';

/** Runtime configuration loaded once during CLI UI startup. */
export const runtimeConfig = await fetchRuntimeConfig();

/** Whether AI development tools are enabled for this runtime. */
export const aiDevtoolsEnabled =
  import.meta.env.DEV || Boolean(runtimeConfig.aiDevtools);

/** Whether experimental SQLRooms features are enabled for this runtime. */
export const experimentalEnabled = Boolean(runtimeConfig.experimentalEnabled);
