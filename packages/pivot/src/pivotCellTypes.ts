import {z} from 'zod';
import {PivotConfig, PivotRelationViews, PivotSource} from './types';
import {createDefaultPivotConfig} from './PivotCoreSlice';
import type {Cell} from '@sqlrooms/cells';

export const PivotCellData = z.object({
  title: z.string().default('Pivot'),
  source: PivotSource.optional(),
  pivotConfig: PivotConfig.default(createDefaultPivotConfig()),
});
export type PivotCellData = z.infer<typeof PivotCellData>;

export const PivotCell = z.object({
  id: z.string(),
  type: z.literal('pivot'),
  data: PivotCellData,
});
export type PivotCell = z.infer<typeof PivotCell>;
export const PivotCellSchema = PivotCell;

export const PivotCellStatus = z.object({
  type: z.literal('pivot'),
  status: z.enum(['idle', 'running', 'success', 'cancel', 'error']),
  stale: z.boolean().default(true),
  lastError: z.string().optional(),
  resultViews: PivotRelationViews.optional(),
  sourceRelation: z.string().optional(),
  lastRunTime: z.number().optional(),
});
export type PivotCellStatus = z.infer<typeof PivotCellStatus>;

export function isPivotCell(cell: Cell): cell is PivotCell {
  return cell.type === 'pivot';
}
