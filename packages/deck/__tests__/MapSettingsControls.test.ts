import {describe, expect, test} from '@jest/globals';
import type {TableColumn} from '@sqlrooms/duckdb';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  classifyDeckMapCoordinateColumn,
  filterDeckMapColumns,
  listDeckMapGeometryPickerColumns,
  pickDeckMapArcCoordinateColumns,
  pickDeckMapArcGeometryColumns,
  pickDeckMapCoordinateColumns,
  pickDeckMapSourceGeometryColumn,
  resolveDeckMapLonLatPair,
} from '../src/MapSettingsControls';

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
    expect(
      filterDeckMapColumns(columns, 'geometry').map((column) => column.name),
    ).toEqual(['geometry']);
    expect(
      filterDeckMapColumns(columns, 'position').map((column) => column.name),
    ).toEqual(['magnitude', 'geometry']);
    expect(
      filterDeckMapColumns(
        [
          ...columns,
          {name: 'geom', type: 'BLOB'},
          {name: '__sqlrooms_geom', type: 'BLOB'},
        ],
        'geometry',
      ).map((column) => column.name),
    ).toEqual(['geometry', 'geom', '__sqlrooms_geom']);
    expect(
      filterDeckMapColumns(
        [
          {name: 'origin_geom'},
          {name: 'dest_geom', type: 'BLOB'},
          {name: 'pickup', type: 'GEOMETRY'},
          {name: 'count', type: 'DOUBLE'},
        ],
        'geometry',
      ).map((column) => column.name),
    ).toEqual(['origin_geom', 'dest_geom', 'pickup']);
    expect(filterDeckMapColumns(columns, 'all')).toBe(columns);
  });

  test('keeps native geometry in the Geom tab after lon/lat transform inspect', () => {
    const sourceColumns: TableColumn[] = [
      {name: 'shape', type: 'GEOMETRY'},
      {name: 'longitude', type: 'DOUBLE'},
      {name: 'latitude', type: 'DOUBLE'},
    ];
    const outputColumns: TableColumn[] = [
      {name: 'shape', type: 'VARCHAR'},
      {name: 'longitude', type: 'DOUBLE'},
      {name: 'latitude', type: 'DOUBLE'},
      {name: '__sqlrooms_geom', type: 'BLOB'},
    ];
    const isGeneratedColumn = (columnName: string) =>
      columnName === '__sqlrooms_geom';

    expect(
      listDeckMapGeometryPickerColumns({
        sourceColumns,
        outputColumns,
        extraColumnNames: ['__sqlrooms_geom'],
        isGeneratedColumn,
      }).map((column) => column.name),
    ).toEqual(['shape']);
    expect(
      listDeckMapGeometryPickerColumns({
        sourceColumns,
        outputColumns,
        extraColumnNames: ['shape', '__sqlrooms_geom'],
        isGeneratedColumn,
      }),
    ).toEqual([{name: 'shape', type: 'GEOMETRY'}]);
    expect(
      listDeckMapGeometryPickerColumns({
        sourceColumns: [],
        outputColumns,
        extraColumnNames: ['shape'],
        isGeneratedColumn,
      }).map((column) => column.name),
    ).toEqual(['shape']);
  });

  test('restores a source geometry column after lon/lat mode', () => {
    const sourceColumns: TableColumn[] = [
      {name: 'geom', type: 'GEOMETRY'},
      {name: 'longitude', type: 'DOUBLE'},
      {name: 'latitude', type: 'DOUBLE'},
    ];

    expect(pickDeckMapSourceGeometryColumn(sourceColumns)).toBe('geom');
    expect(pickDeckMapSourceGeometryColumn(sourceColumns, 'geom')).toBe('geom');
    expect(
      pickDeckMapSourceGeometryColumn(
        [...sourceColumns, {name: 'shape', type: 'GEOMETRY'}],
        'shape',
      ),
    ).toBe('shape');
    expect(
      pickDeckMapSourceGeometryColumn([
        {name: 'geom', type: 'GEOMETRY'},
        {name: 'shape', type: 'GEOMETRY'},
      ]),
    ).toBeUndefined();
  });

  test('restores arc source/target geometry columns after lon/lat mode', () => {
    const sourceColumns: TableColumn[] = [
      {name: 'origin_geom', type: 'GEOMETRY'},
      {name: 'dest_geom', type: 'GEOMETRY'},
      {name: 'origin_lon', type: 'DOUBLE'},
    ];

    expect(pickDeckMapArcGeometryColumns(sourceColumns)).toEqual({
      sourceGeometryColumn: 'origin_geom',
      targetGeometryColumn: 'dest_geom',
    });
    expect(
      pickDeckMapArcGeometryColumns(sourceColumns, {
        sourceGeometryColumn: 'dest_geom',
        targetGeometryColumn: 'origin_geom',
      }),
    ).toEqual({
      sourceGeometryColumn: 'dest_geom',
      targetGeometryColumn: 'origin_geom',
    });
    expect(
      pickDeckMapArcGeometryColumns(
        [
          {name: 'origin_geom', type: 'GEOMETRY'},
          {name: 'dest_geom', type: 'GEOMETRY'},
        ],
        {
          sourceGeometryColumn: 'source_geom',
          targetGeometryColumn: 'target_geom',
        },
      ),
    ).toEqual({
      sourceGeometryColumn: 'origin_geom',
      targetGeometryColumn: 'dest_geom',
    });
    expect(
      pickDeckMapArcGeometryColumns([
        {name: 'geom', type: 'GEOMETRY'},
        {name: 'origin_geom', type: 'GEOMETRY'},
        {name: 'dest_geom', type: 'GEOMETRY'},
      ]),
    ).toEqual({
      sourceGeometryColumn: undefined,
      targetGeometryColumn: undefined,
    });
  });

  test('restores lon/lat columns after geom mode when they still exist', () => {
    const sourceColumns: TableColumn[] = [
      {name: 'geom', type: 'GEOMETRY'},
      {name: 'longitude', type: 'DOUBLE'},
      {name: 'latitude', type: 'DOUBLE'},
    ];

    expect(
      pickDeckMapCoordinateColumns(sourceColumns, {
        latitudeColumn: 'latitude',
        longitudeColumn: 'longitude',
      }),
    ).toEqual({
      latitudeColumn: 'latitude',
      longitudeColumn: 'longitude',
    });
    expect(
      pickDeckMapCoordinateColumns(sourceColumns, {
        latitudeColumn: 'missing_lat',
        longitudeColumn: 'longitude',
      }),
    ).toEqual({
      latitudeColumn: undefined,
      longitudeColumn: 'longitude',
    });
    expect(
      pickDeckMapArcCoordinateColumns(sourceColumns, {
        sourceLatitudeColumn: 'latitude',
        sourceLongitudeColumn: 'longitude',
        targetLatitudeColumn: 'gone_lat',
        targetLongitudeColumn: 'gone_lon',
      }),
    ).toEqual({
      sourceLatitudeColumn: 'latitude',
      sourceLongitudeColumn: 'longitude',
      targetLatitudeColumn: undefined,
      targetLongitudeColumn: undefined,
    });
  });

  test('pairs first/second position columns into lon/lat', () => {
    expect(classifyDeckMapCoordinateColumn('lat')).toBe('latitude');
    expect(classifyDeckMapCoordinateColumn('longitude')).toBe('longitude');
    expect(classifyDeckMapCoordinateColumn('count')).toBe('unknown');
    expect(resolveDeckMapLonLatPair('lat', 'lon')).toEqual({
      latitudeColumn: 'lat',
      longitudeColumn: 'lon',
    });
    expect(resolveDeckMapLonLatPair('longitude', 'latitude')).toEqual({
      longitudeColumn: 'longitude',
      latitudeColumn: 'latitude',
    });
    expect(resolveDeckMapLonLatPair('start_x', 'start_y')).toEqual({
      latitudeColumn: 'start_x',
      longitudeColumn: 'start_y',
    });
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
    expect(panelSource).toContain('usesPointCoordinateSetting');
    expect(panelSource).toContain('Lon/Lat');
    expect(panelSource).toContain('hasPointGeometryColumns');
    expect(panelSource).toContain('parseDeckMapPointTransformSql');
    expect(panelSource).toContain('pointGeometryColumns');
    expect(panelSource).toContain('listDeckMapGeometryPickerColumns');
    expect(panelSource).toContain('pickDeckMapSourceGeometryColumn');
    expect(panelSource).toContain('pickDeckMapArcGeometryColumns');
    expect(panelSource).toContain('pickDeckMapCoordinateColumns');
    expect(panelSource).toContain('pickDeckMapArcCoordinateColumns');
    expect(panelSource).toContain('parseDeckMapArcTransformSql');
    expect(panelSource).toContain('lastPointCoordinatesRef');
    expect(panelSource).toContain('lastArcCoordinatesRef');
    expect(panelSource).toContain('nativeArcSourceGeometryColumn');
    expect(panelSource).toContain('isDeckMapGeneratedTransformColumn');
    expect(panelSource).toContain('arcGeometryColumns');
    expect(panelSource).toContain('Source latitude');
    expect(panelSource).toContain('showGeometryGroup');
    expect(panelSource).toContain('H3 index');
    expect(panelSource).toContain('label="Timestamp"');
    expect(documentAdapterSource).toContain('applyDeckMapTableSelection');
    expect(documentAdapterSource).toContain('preferDatasetSource');
    expect(dashboardAdapterSource).not.toContain('preferDatasetSource');
  });
});
