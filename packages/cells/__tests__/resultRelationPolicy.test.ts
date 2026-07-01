import {makeQualifiedTableName} from '@sqlrooms/duckdb';
import {createOrReplaceResultRelation} from '../src/resultRelationPolicy';

describe('result relation SQL boundaries', () => {
  it('quotes parsed relation names before SQL interpolation', async () => {
    const queries: string[] = [];
    const connector = {
      query: (sql: string) => {
        queries.push(sql);
        return Promise.resolve();
      },
    };

    await createOrReplaceResultRelation({
      connector,
      relationName: 'artifact_1.events.2026',
      relationType: 'view',
      sql: 'SELECT 1',
    });

    expect(queries[0]).toBe(
      'CREATE OR REPLACE VIEW "artifact_1"."events"."2026" AS SELECT 1',
    );
  });

  it('rejects invalid relation names at direct SQL boundaries', async () => {
    const connector = {
      query: () => Promise.resolve(),
    };

    await expect(
      createOrReplaceResultRelation({
        connector,
        relationName: 'artifact_1.',
        relationType: 'view',
        sql: 'SELECT 1',
      }),
    ).rejects.toThrow(/Invalid SQL cell result relation/);
  });

  it('validates structured relation names through the same SQL boundary', async () => {
    const queries: string[] = [];
    const connector = {
      query: (sql: string) => {
        queries.push(sql);
        return Promise.resolve();
      },
    };

    await createOrReplaceResultRelation({
      connector,
      relationName: makeQualifiedTableName({
        schema: 'artifact_1',
        table: 'events.2026',
      }),
      relationType: 'table',
      sql: 'SELECT 1',
    });

    expect(queries[0]).toBe(
      'CREATE OR REPLACE TABLE "artifact_1"."events.2026" AS SELECT 1',
    );
  });
});
