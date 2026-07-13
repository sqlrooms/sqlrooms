import {describe, expect, test} from '@jest/globals';
import type {TableColumn} from '@sqlrooms/duckdb';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {filterDeckMapColumns} from '../src/MapSettingsControls';

const columns: TableColumn[] = [
  {name: 'name', type: 'VARCHAR'},
  {name: 'magnitude', type: 'DOUBLE'},
  {name: 'observed_at', type: 'TIMESTAMP'},
  {name: 'geometry', type: 'GEOMETRY'},
];

describe('Deck map settings controls', () => {
  test('filters column choices without relying on Mosaic field context', () => {
    expect(
      filterDeckMapColumns(columns, 'numeric').map((column) => column.name),
    ).toEqual(['magnitude']);
    expect(
      filterDeckMapColumns(columns, 'quantitative').map(
        (column) => column.name,
      ),
    ).toEqual(['magnitude', 'observed_at']);
    expect(
      filterDeckMapColumns(columns, 'categorical').map((column) => column.name),
    ).toEqual(['name']);
    expect(filterDeckMapColumns(columns, 'all')).toBe(columns);
  });

  test('shares one Mosaic-free settings panel across worksheet and dashboard adapters', () => {
    const packageRoot = [
      process.cwd(),
      join(process.cwd(), 'packages/deck'),
      join(process.cwd(), 'packages/sqlrooms/packages/deck'),
    ].find((candidate) => existsSync(join(candidate, 'src/MapSettings.tsx')));
    expect(packageRoot).toBeDefined();

    const readSource = (fileName: string) =>
      readFileSync(join(packageRoot!, 'src', fileName), 'utf8');
    const panelSource = readSource('MapSettings.tsx');
    const worksheetAdapterSource = readSource('BlockMapSettings.tsx');
    const dashboardAdapterSource = readSource('DashboardMapSettings.tsx');

    expect(panelSource).not.toContain('@sqlrooms/mosaic');
    expect(worksheetAdapterSource).not.toContain('@sqlrooms/mosaic');
    expect(worksheetAdapterSource).toContain('<DeckMapSettingsPanel');
    expect(dashboardAdapterSource).toContain('<DeckMapSettingsPanel');
  });
});
