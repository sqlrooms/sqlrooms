import {z} from 'zod';
import type {Cell} from '@sqlrooms/cells';

export const PivotCellData = z.object({
  pivotId: z.string(),
});
export type PivotCellData = z.infer<typeof PivotCellData>;

export const PivotCell = z.object({
  id: z.string(),
  type: z.literal('pivot'),
  data: PivotCellData,
});
export type PivotCell = z.infer<typeof PivotCell>;
export const PivotCellSchema = PivotCell;

export function isPivotCell(cell: Cell): cell is PivotCell {
  return cell.type === 'pivot';
}
