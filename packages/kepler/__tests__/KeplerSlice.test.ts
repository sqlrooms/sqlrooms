import {createDefaultKeplerConfig} from '../src/KeplerSlice';

describe('createDefaultKeplerConfig', () => {
  it('creates the documented initial map', () => {
    const config = createDefaultKeplerConfig();

    expect(config.maps).toHaveLength(1);
    expect(config.maps[0]).toMatchObject({name: 'Untitled Map'});
  });

  it('preserves an explicitly empty map collection', () => {
    expect(createDefaultKeplerConfig({maps: []}).maps).toEqual([]);
  });
});
