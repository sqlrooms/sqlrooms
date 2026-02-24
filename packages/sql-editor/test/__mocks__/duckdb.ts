export function separateLastStatement(query: string): {
  priorStatements: string;
  finalStatement: string;
} {
  const trimmed = query.trim();
  return {
    priorStatements: '',
    finalStatement: trimmed,
  };
}

export function joinStatements(
  priorStatements: string,
  finalStatement: string,
): string {
  return [priorStatements, finalStatement].filter(Boolean).join(';\n');
}

export function makeLimitQuery(query: string, _limit: number): string {
  return query;
}

export function getSqlErrorWithPointer(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export type DuckDbSliceState = {
  db: Record<string, unknown>;
};
