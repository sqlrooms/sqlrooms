import {createWasmDuckDbConnector} from '../src/connectors/WasmDuckDbConnector';

// These checks run before the connector touches DuckDB-Wasm, so they work
// without a Worker or an initialized database.
describe('WasmDuckDbConnector temp objects', () => {
  const tempError =
    /temporary tables and views are not supported by the DuckDB-Wasm connector/;

  it('rejects temp: true in loadFile', async () => {
    const connector = createWasmDuckDbConnector();
    await expect(
      connector.loadFile('data.csv', 'staging', {method: 'auto', temp: true}),
    ).rejects.toThrow(tempError);
    await expect(
      connector.loadFile('data.csv', 'staging', {
        method: 'read_csv',
        temp: true,
      }),
    ).rejects.toThrow(/^loadFile: /);
  });

  it('rejects temp: true in loadObjects', async () => {
    const connector = createWasmDuckDbConnector();
    await expect(
      connector.loadObjects([{id: 1}], 'staging', {temp: true}),
    ).rejects.toThrow(/^loadObjects: .*not supported by the DuckDB-Wasm/);
  });

  it('does not reject non-temp loads for being temp', async () => {
    const connector = createWasmDuckDbConnector();
    // Uninitialized, so these fail later, for a different reason.
    await expect(
      connector.loadFile('data.csv', 'regular', {method: 'auto'}),
    ).rejects.toThrow('DuckDB connection not initialized');
    await expect(
      connector.loadObjects([{id: 1}], 'regular', {temp: false}),
    ).rejects.toThrow('DuckDB connection not initialized');
  });
});
