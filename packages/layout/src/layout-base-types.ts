/**
 * Base types used across the layout package to avoid circular dependencies.
 * These types should have minimal dependencies.
 */

export type LayoutPath = (string | number)[];

export type PanelContainerType =
  | 'tabs'
  | 'mosaic'
  | 'split'
  | 'dock'
  | 'grid'
  | 'root';

export type ParentDirection = 'row' | 'column';
