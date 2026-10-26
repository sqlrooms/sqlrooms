import {describe, expect, it} from '@jest/globals';
import {sliceSchemas} from '../model';
import {contentSchemas, viewSchemas} from '../stateOwnership';

describe('Roomie persisted field ownership', () => {
  it('classifies every persisted config field exactly once', () => {
    const owners = [contentSchemas, viewSchemas];
    for (const [slice, schema] of Object.entries(sliceSchemas)) {
      for (const field of Object.keys(schema.shape)) {
        const matches = owners.filter((owner) => {
          const ownerSchema = owner[slice as keyof typeof owner];
          return ownerSchema && field in ownerSchema.shape;
        });
        expect({field: `${slice}.${field}`, owners: matches.length}).toEqual({
          field: `${slice}.${field}`,
          owners: 1,
        });
      }
    }
  });
});
