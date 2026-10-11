import type {
  PanelDefinition,
  PanelDefinitionContext,
  RoomPanelInfo,
} from './types';

export function resolvePanelDefinition(
  definition: PanelDefinition,
  context: PanelDefinitionContext,
): RoomPanelInfo {
  if (typeof definition === 'function') {
    return definition(context);
  }
  return definition;
}
