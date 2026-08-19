import {describe, expect, it} from '@jest/globals';
import {
  CosmosSliceConfig,
  createDefaultCosmosConfig,
} from '../src/CosmosSliceConfig';

const PersistMergeInputSymbol = Symbol.for('sqlrooms.persist.mergeInput');

function createPersistMergeInput(persisted: unknown) {
  const buildMergeInput = (
    CosmosSliceConfig as typeof CosmosSliceConfig & {
      [PersistMergeInputSymbol]: (input: {
        defaults: unknown;
        persisted: unknown;
      }) => unknown;
    }
  )[PersistMergeInputSymbol];

  return buildMergeInput({
    defaults: createDefaultCosmosConfig(),
    persisted,
  });
}

describe('CosmosSliceConfig persistence migration', () => {
  it('parses plain current configuration without treating it as merge input', () => {
    const config = {
      ...createDefaultCosmosConfig(),
      pointSizeScale: 2,
    };

    expect(CosmosSliceConfig.parse(config)).toEqual(config);
  });

  it('preserves the public Zod object composition API', () => {
    expect(CosmosSliceConfig.partial().parse({pointSizeScale: 2})).toEqual({
      pointSizeScale: 2,
    });
  });

  it('fills new defaults and migrates the Cosmos 2 link arrow option', () => {
    const config = CosmosSliceConfig.parse(
      createPersistMergeInput({
        pointSizeScale: 2,
        linkArrows: true,
      }),
    );

    expect(config).toEqual({
      ...createDefaultCosmosConfig(),
      pointSizeScale: 2,
      linkDefaultArrows: true,
    });
    expect(config.transitionDuration).toBe(0);
    expect(config).not.toHaveProperty('linkArrows');
  });

  it('prefers an explicit Cosmos 3 link arrow option', () => {
    const config = CosmosSliceConfig.parse(
      createPersistMergeInput({
        linkArrows: true,
        linkDefaultArrows: false,
      }),
    );

    expect(config.linkDefaultArrows).toBe(false);
  });
});
