/**
 * Built-in skills shipped with the example. Every seed goes through the real
 * `parseSkillManifest` + `loadSkillFromFiles` pipeline at startup — if any of
 * these YAML blobs drifts out of schema, the example will crash loudly rather
 * than silently render a broken catalog.
 *
 * Seeds intentionally reference the example's single `querySQL` tool and
 * nothing else. No host-specific vocabulary, no live table names.
 */

import type {SkillFile} from '@sqlrooms/ai';

export interface SeedSkill {
  id: string;
  rootId: string;
  files: SkillFile[];
}

const SUMMARIZE_TABLE: SeedSkill = {
  id: 'summarize-table',
  rootId: 'built-in',
  files: [
    {
      relativePath: 'skill.yaml',
      content: `id: summarize-table
version: 0.1.0
name: Summarize table
description: Produce a compact statistical summary of a given table's columns.
author: SQLRooms
`,
    },
    {
      relativePath: 'SKILL.md',
      content: `# Summarize table

Use \`querySQL\` to describe the target table, then return a short summary.

## Steps

1. Call \`querySQL\` with \`DESCRIBE <table>\` to list columns and types.
2. For each numeric column, call \`querySQL\` with
   \`SELECT COUNT(*), MIN(col), MAX(col), AVG(col) FROM <table>\`.
3. For each text column, return the top 5 values by frequency.
4. Format the findings as a short markdown table.

Keep the whole response under 200 words.
`,
    },
  ],
};

const PLOT_COLUMN: SeedSkill = {
  id: 'plot-column',
  rootId: 'built-in',
  files: [
    {
      relativePath: 'skill.yaml',
      content: `id: plot-column
version: 0.1.0
name: Plot a column
description: Bucket a numeric column and describe its distribution in words.
author: SQLRooms
`,
    },
    {
      relativePath: 'SKILL.md',
      content: `# Plot a column

The runtime has no chart renderer — describe the shape of a column in words
using only \`querySQL\`.

## Steps

1. Call \`querySQL\` with \`SELECT MIN(col), MAX(col) FROM <table>\` for the
   target column.
2. Divide the range into 10 equal-width buckets and run a \`GROUP BY\` over
   \`width_bucket(col, min, max, 10)\` (or the SQL dialect's equivalent).
3. Report the bucket counts as an ASCII bar chart, one line per bucket.
4. Add a one-sentence description of the distribution (skew, outliers, mode).
`,
    },
  ],
};

const FIND_DUPLICATES: SeedSkill = {
  id: 'find-duplicates',
  rootId: 'built-in',
  files: [
    {
      relativePath: 'skill.yaml',
      content: `id: find-duplicates
version: 0.1.0
name: Find duplicate rows
description: Identify duplicate rows by a caller-supplied key column.
author: SQLRooms
`,
    },
    {
      relativePath: 'SKILL.md',
      content: `# Find duplicate rows

Given a table and a key column, surface rows that share the same key value.

## Steps

1. Ask the user (or the calling agent) which column is the key.
2. Call \`querySQL\` with
   \`SELECT <key>, COUNT(*) c FROM <table> GROUP BY <key> HAVING c > 1 ORDER BY c DESC LIMIT 20\`.
3. If the result is empty, return "No duplicates found" and stop.
4. Otherwise, for each of the top 3 duplicated key values, call \`querySQL\`
   with \`SELECT * FROM <table> WHERE <key> = ? LIMIT 5\` and return the rows.
`,
    },
  ],
};

export const SEED_SKILLS: SeedSkill[] = [
  SUMMARIZE_TABLE,
  PLOT_COLUMN,
  FIND_DUPLICATES,
];
