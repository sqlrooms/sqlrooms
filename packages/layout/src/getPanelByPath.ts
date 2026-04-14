import type {LayoutPath} from './types';

export type MatchResultParams = Record<string, string | number>;

export type MatchResult<T> = {
  panelId: string;
  panel: T;
  params: MatchResultParams;
};

/**
 * Gets a panel by matching a node path from the layout tree to a panel entry.
 *
 * The function tries to match the path suffix against panel keys in the order
 * they are defined, handling placeholder parameters like {dashboardId}, {chartId}, etc.
 *
 * **How it works:**
 * - Iterates through panel keys in definition order
 * - Matches each pattern against the END of the path (suffix matching)
 * - Extracts parameters from segments matching `{paramName}` placeholders
 * - Returns the first match found
 *
 * **Important:** The first matching panel key is returned, so order matters!
 * Define more specific patterns before general ones to avoid unexpected matches.
 *
 * @param panels - Map of panel patterns to panel info objects
 * @param layoutPath - Path segments from layout tree (can be nested arrays)
 * @returns Match result with panelId (last path segment), panel info, and extracted params, or null if no match
 *
 * @example
 * // Simple match - no parameters
 * const panels = { 'dashboards': {...} };
 * getPanelByPath(panels, ['root', 'main', 'dashboards'])
 * // Returns: { panelId: 'dashboards', panel: {...}, params: {} }
 *
 * @example
 * // Parameterized match
 * const panels = { 'dashboards/{dashboardId}/{chartId}': {...} };
 * getPanelByPath(panels, ['root', 'main', 'dashboards', 'overview', 'users'])
 * // Pattern 'dashboards/{dashboardId}/{chartId}' matches last 3 segments
 * // Returns: {
 * //   panelId: 'users',  // last segment of the matched path
 * //   panel: panels['dashboards/{dashboardId}/{chartId}'],
 * //   params: { dashboardId: 'overview', chartId: 'users' }
 * // }
 *
 * @example
 * // Pattern ordering matters
 * const panels = {
 *   'users': {...},           // More general
 *   'users/{userId}': {...}   // More specific - should come FIRST
 * };
 * // If you define them in wrong order, 'users' will match before 'users/{userId}'
 */
export function getPanelByPath<T>(
  panels: Record<string, T>,
  layoutPath: LayoutPath | LayoutPath[],
): MatchResult<T> | null {
  const path = layoutPath.flatMap((segment) =>
    Array.isArray(segment) ? segment : [segment],
  );

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
