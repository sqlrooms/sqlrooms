import type {ChartBuilderColumn} from './base-types';

export function validateColumnExists(
  columnName: string,
  expectedTypes: string[] | undefined,
  columns: ChartBuilderColumn[],
  fieldKey: string,
): void {
  const column = columns.find((candidate) => candidate.name === columnName);
  if (!column) {
    throw new Error(
      `Unknown column "${columnName}" for field "${fieldKey}". Available columns: ${columns.map((c) => c.name).join(', ') || '(none)'}.`,
    );
  }

  if (
    expectedTypes?.length &&
    !expectedTypes.some(
      (type) => type.toUpperCase() === column.type.toUpperCase(),
    )
  ) {
    throw new Error(
      `Column "${columnName}" has type ${column.type} but field "${fieldKey}" expects ${expectedTypes.join(', ')}.`,
    );
  }
}
