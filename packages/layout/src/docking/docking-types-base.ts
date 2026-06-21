export type DockDirection = 'left' | 'right' | 'up' | 'down';
export type DockAxis = 'row' | 'column';

export function getDockAxis(direction: DockDirection): DockAxis {
  return direction === 'left' || direction === 'right' ? 'row' : 'column';
}
