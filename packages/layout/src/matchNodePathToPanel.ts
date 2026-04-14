import type {LayoutPath} from './types';

export type MatchResultParams = Record<string, string | number>;

export type MatchResult<T> = {
  panelId: string;
  panel: T;
  params: MatchResultParams;
};

/**
 * Matches a node path from the layout tree to a panel entry.
 *
 * The function tries to match the path suffix against panel keys in the order
 * they are defined, handling placeholder parameters like {dashboardId}, {chartId}, etc.
 *
 * Note: The first matching panel key is returned, so order matters!
 * Define more specific patterns before general ones.
 *
 * @example
 * // Simple match
 * matchNodePathToPanel(panels, ['root', 'main', 'dashboards'])
 * // Returns: { panelId: 'dashboards', params: {} }
 *
 * @example
 * // Match with parameters
 * matchNodePathToPanel(panels, ['root', 'main', 'dashboards', 'overview', 'users'])
 * // Returns: {
 * //   panelId: 'users',
 * //   panel: panels['dashboards/{dashboardId}/{chartId}'],
 * //   params: { dashboardId: 'overview', chartId: 'users' }
 * // }
 */
export function matchNodePathToPanel<T>(
  panels: Record<string, T>,
  path: LayoutPath,
): MatchResult<T> | null {
  // Try to match each panel key against the path in the order they are defined
  for (const panelId of Object.keys(panels)) {
    const patternSegments = panelId.split('/');

    // Can't match if pattern is longer than path
    if (patternSegments.length > path.length) {
      continue;
    }

    // Try to match the last N segments of the path (working backwards)
    const startIdx = path.length - patternSegments.length;
    let matched = true;
    const params: MatchResultParams = {};

    for (let i = 0; i < patternSegments.length; i++) {
      const patternSegment = patternSegments[i];
      const pathSegment = path[startIdx + i];

      if (
        patternSegment === null ||
        patternSegment === undefined ||
        pathSegment === null ||
        pathSegment === undefined
      ) {
        matched = false;
        break;
      }

      if (patternSegment.startsWith('{') && patternSegment.endsWith('}')) {
        // This is a parameter placeholder - extract the parameter name and value
        const paramName = patternSegment.slice(1, -1);
        params[paramName] = pathSegment;
        continue;
      }

      // This is a literal segment - must match exactly
      if (patternSegment !== pathSegment) {
        matched = false;
        break;
      }
    }

    if (matched) {
      const panel = panels[panelId];
      if (panel !== undefined) {
        // Return the last segment of the matched path as the panelId
        const matchedPanelId = String(path[path.length - 1]);
        return {panelId: matchedPanelId, panel, params};
      }
    }
  }

  return null;
}
