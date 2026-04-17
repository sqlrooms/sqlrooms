/**
 * Base types used across the layout package to avoid circular dependencies.
 * These types should have minimal dependencies.
 */

export type LayoutPath = (string | number)[];

export type PanelContainerType = 'tabs' | 'mosaic' | 'split' | 'root';

export type ParentDirection = 'row' | 'column';

export type MatchResultParams = Record<string, string | number>;

export type MatchResult<T> = {
  panelId: string;
  panel: T;
  params: MatchResultParams;
};
