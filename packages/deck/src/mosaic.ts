/** Opt-in Mosaic dashboard adapter for Deck map panels. */
export {
  DECK_MAP_AI_INSTRUCTIONS,
  createDashboardAgentToolWithDeckMaps,
  createDashboardWithDeckMapAiTools,
  createDeckMapAiTools,
  createDeckMapDashboardAiTools,
  createDeckMapDashboardTool,
  createDeckMapConfigTool,
  createDeckMapPanelFromNativeConfig,
  DeckMapDashboardConfigParameter,
  DeckMapConfigToolParameters,
  DeckMapDashboardToolParameters,
  getDashboardWithDeckMapAiInstructions,
} from './ai';
export type {
  DeckMapConfigToolParams,
  DeckMapDashboardConfigToolConfig,
  DeckMapDashboardToolParams,
} from './ai';
export {
  deckMapDashboardAddPanelAction,
  deckMapDashboardPanelRenderer,
} from './dashboard';
export {DeckMapDashboardSettings} from './DashboardMapSettings';
export {MapSettingsPanel} from './MapSettings';
export {createDeckMapDashboardSliceOptions} from './dashboardIntegration';
export * from './dashboardConfig';
