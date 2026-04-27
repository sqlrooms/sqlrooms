import {qualifyArtifactLocalResultNames} from '../src/sqlHelpers';
import type {Cell} from '../src/types';

describe('qualifyArtifactLocalResultNames', () => {
  const cells: Record<string, Cell> = {
    a: {
      id: 'a',
      type: 'sql',
      data: {title: 'A', sql: 'select 1', resultName: 'result_a'},
    },
    b: {
      id: 'b',
      type: 'sql',
      data: {title: 'B', sql: 'select 2', resultName: 'result_b'},
    },
  };

  it('qualifies unqualified same-sheet result names', () => {
    const sql =
      'select * from result_a join result_b on result_a.x = result_b.x';
    const out = qualifyArtifactLocalResultNames({
      sql,
      artifactSchema: 'artifact_1',
      artifactCellIds: ['a', 'b'],
      cells,
      getSqlResultName: (id) => (cells[id]?.data as any)?.resultName,
    });

    expect(out).toContain('artifact_1.result_a');
    expect(out).toContain('artifact_1.result_b');
  });

  it('does not rewrite already-qualified names', () => {
    const sql = 'select * from other_schema.result_a join result_a on true';
    const out = qualifyArtifactLocalResultNames({
      sql,
      artifactSchema: 'artifact_1',
      artifactCellIds: ['a'],
      cells,
      getSqlResultName: (id) => (cells[id]?.data as any)?.resultName,
    });

    expect(out).toContain('other_schema.result_a');
    expect(out).toContain('artifact_1.result_a');
  });

  it('does not rewrite partial identifier matches', () => {
    const sql = 'select * from result_a_backup';
    const out = qualifyArtifactLocalResultNames({
      sql,
      artifactSchema: 'artifact_1',
      artifactCellIds: ['a'],
      cells,
      getSqlResultName: (id) => (cells[id]?.data as any)?.resultName,
    });

    expect(out).toBe(sql);
  });
});
