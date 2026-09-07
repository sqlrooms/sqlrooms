import {describe, expect, test} from '@jest/globals';
import type {TableColumn} from '@sqlrooms/duckdb';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {filterDeckMapColumns} from '../src/MapSettingsControls';

const columns: TableColumn[] = [
  {name: 'name', type: 'VARCHAR'},
  {name: 'magnitude', type: 'DOUBLE'},
  {name: 'observed_at', type: 'TIMESTAMP'},
  {name: 'is_active', type: 'BOOLEAN'},
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
    ).toEqual(['name', 'is_active']);
    expect(
      filterDeckMapColumns(columns, 'colorable').map((column) => column.name),
    ).toEqual(['name', 'magnitude', 'observed_at', 'is_active']);
    expect(filterDeckMapColumns(columns, 'all')).toBe(columns);
  });

  test('shares one Mosaic-free settings panel across document and dashboard adapters', () => {
    const packageRoot = [
      process.cwd(),
      join(process.cwd(), 'packages/deck'),
      join(process.cwd(), 'packages/sqlrooms/packages/deck'),
    ].find((candidate) => existsSync(join(candidate, 'src/MapSettings.tsx')));
    expect(packageRoot).toBeDefined();

    const readSource = (fileName: string) =>
      readFileSync(join(packageRoot!, 'src', fileName), 'utf8');
    const panelSource = readSource('MapSettings.tsx');
    const documentAdapterSource = readSource('BlockMapSettings.tsx');
    const documentSurfaceSource = readSource('DeckMapSurface.tsx');
    const dashboardAdapterSource = readSource('DashboardMapSettings.tsx');

    expect(panelSource).not.toContain('@sqlrooms/mosaic');
    expect(panelSource).not.toContain('configIssues');
    expect(documentAdapterSource).not.toContain('@sqlrooms/mosaic');
    expect(documentAdapterSource).toContain('<DeckMapSettingsPanel');
    expect(documentAdapterSource).not.toContain('configIssues');
    expect(documentAdapterSource).not.toContain('Invalid map configuration:');
    expect(documentSurfaceSource).toContain('Invalid map configuration:');
    expect(documentSurfaceSource).toContain('autoFit: true');
    expect(documentSurfaceSource).toContain("kind: 'fit-error'");
    expect(documentSurfaceSource).toContain("onClearIssue('fit-error')");
    expect(dashboardAdapterSource).toContain('<DeckMapSettingsPanel');
    expect(dashboardAdapterSource).toContain('customConfig=');
    expect(panelSource).toContain('value={sourceDataTable}');
    expect(documentAdapterSource).toContain('applyDeckMapTableSelection');
    expect(documentAdapterSource).toContain('preferDatasetSource');
    expect(dashboardAdapterSource).not.toContain('preferDatasetSource');
  });
});
