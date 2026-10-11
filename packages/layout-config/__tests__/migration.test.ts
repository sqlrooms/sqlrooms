import {LayoutConfig} from '../src/LayoutConfig';
import {migrate} from '../src/migrate';

describe('migrateV1ToV2', () => {
  describe('breaking mosaic removal', () => {
    it('should no longer unwrap obsolete mosaic wrappers during migration', () => {
      const input = {
        type: 'mosaic',
        nodes: {
          direction: 'column',
          splitPercentage: 75,
          first: {
            direction: 'row',
            splitPercentage: 25,
            first: 'data-sources',
            second: {
              direction: 'row',
              splitPercentage: 41.30299844187431,
              first: 'main',
              second: 'assistant',
            },
          },
          second: 'running-queries',
        },
      };
      const result = migrate(input);
      expect(result).toEqual(input);
    });

    it('should reject mosaic configs at schema parse time', () => {
      const result = LayoutConfig.safeParse({
        type: 'mosaic',
        id: 'dashboard',
        layout: 'chart-1',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('binary tree to n-ary conversion', () => {
    it('should convert simple binary split to split with children', () => {
      const input = {
        direction: 'row',
        first: 'panel-a',
        second: 'panel-b',
      };
      const result = migrate(input);
      expect(result).toMatchObject({
        type: 'split',
        direction: 'row',
        children: ['panel-a', 'panel-b'],
      });
      // Check that id was generated
      expect(result).toHaveProperty('id');
      expect(typeof (result as any).id).toBe('string');
    });

    it('should convert nested binary trees', () => {
      const input = {
        direction: 'row',
        first: 'panel-a',
        second: {
          direction: 'column',
          first: 'panel-b',
          second: 'panel-c',
        },
      };
      const result = migrate(input) as any;
      expect(result.type).toBe('split');
      expect(result.direction).toBe('row');
      expect(result.children).toHaveLength(2);
      expect(result.children[0]).toBe('panel-a');
      expect(result.children[1]).toMatchObject({
        type: 'split',
        direction: 'column',
        children: ['panel-b', 'panel-c'],
      });
    });

    it('should preserve direction field', () => {
      const input = {
        direction: 'column',
        first: 'panel-a',
        second: 'panel-b',
      };
      const result = migrate(input);
      expect(result).toMatchObject({
        type: 'split',
        direction: 'column',
      });
    });
  });

  describe('split percentage conversion', () => {
    it('should convert splitPercentage to defaultSize on children', () => {
      const input = {
        direction: 'row',
        first: 'panel-a',
        second: 'panel-b',
        splitPercentage: 30,
      };
      const result = migrate(input) as any;
      expect(result.type).toBe('split');
      expect(result.children).toHaveLength(2);

      // First child should have 30% size
      expect(result.children[0]).toMatchObject({
        type: 'panel',
        id: 'panel-a',
        defaultSize: '30%',
      });

      // Second child should have 70% size
      expect(result.children[1]).toMatchObject({
        type: 'panel',
        id: 'panel-b',
        defaultSize: '70%',
      });

      // Parent should not have splitPercentage
      expect(result).not.toHaveProperty('splitPercentage');
    });

    it('should handle splitPercentage: 0', () => {
      const input = {
        direction: 'row',
        first: 'panel-a',
        second: 'panel-b',
        splitPercentage: 0,
      };
      const result = migrate(input) as any;
      expect(result.children[0]).toMatchObject({
        type: 'panel',
        id: 'panel-a',
        defaultSize: '0%',
      });
      expect(result.children[1]).toMatchObject({
        type: 'panel',
        id: 'panel-b',
        defaultSize: '100%',
      });
    });

    it('should handle splitPercentage: 50', () => {
      const input = {
        direction: 'row',
        first: 'panel-a',
        second: 'panel-b',
        splitPercentage: 50,
      };
      const result = migrate(input) as any;
      expect(result.children[0]).toMatchObject({
        type: 'panel',
        id: 'panel-a',
        defaultSize: '50%',
      });
      expect(result.children[1]).toMatchObject({
        type: 'panel',
        id: 'panel-b',
        defaultSize: '50%',
      });
    });

    it('should handle splitPercentage: 100', () => {
      const input = {
        direction: 'row',
        first: 'panel-a',
        second: 'panel-b',
        splitPercentage: 100,
      };
      const result = migrate(input) as any;
      expect(result.children[0]).toMatchObject({
        type: 'panel',
        id: 'panel-a',
        defaultSize: '100%',
      });
      expect(result.children[1]).toMatchObject({
        type: 'panel',
        id: 'panel-b',
        defaultSize: '0%',
      });
    });

    it('should handle missing splitPercentage (no defaultSize applied)', () => {
      const input = {
        direction: 'row',
        first: 'panel-a',
        second: 'panel-b',
      };
      const result = migrate(input) as any;
      expect(result.type).toBe('split');
      expect(result.children).toEqual(['panel-a', 'panel-b']);
    });

    it('should handle nested splits with different percentages', () => {
      const input = {
        direction: 'row',
        first: 'panel-a',
        second: {
          direction: 'column',
          first: 'panel-b',
          second: 'panel-c',
          splitPercentage: 60,
        },
        splitPercentage: 30,
      };
      const result = migrate(input) as any;

      // First child should have 30% size
      expect(result.children[0]).toMatchObject({
        type: 'panel',
        id: 'panel-a',
        defaultSize: '30%',
      });

      // Second child should be nested split with 70% size
      const secondChild = result.children[1];
      expect(secondChild).toMatchObject({
        type: 'split',
        direction: 'column',
        defaultSize: '70%',
      });

      // Nested split children should have their own percentages
      expect(secondChild.children[0]).toMatchObject({
        type: 'panel',
        id: 'panel-b',
        defaultSize: '60%',
      });
      expect(secondChild.children[1]).toMatchObject({
        type: 'panel',
        id: 'panel-c',
        defaultSize: '40%',
      });
    });

    it('should wrap object nodes with defaultSize when they have splitPercentage', () => {
      const input = {
        direction: 'row',
        first: {
          type: 'panel',
          id: 'existing-panel',
        },
        second: 'panel-b',
        splitPercentage: 40,
      };
      const result = migrate(input) as any;

      expect(result.children[0]).toMatchObject({
        type: 'panel',
        id: 'existing-panel',
        defaultSize: '40%',
      });
      expect(result.children[1]).toMatchObject({
        type: 'panel',
        id: 'panel-b',
        defaultSize: '60%',
      });
    });

    it('should not override existing defaultSize', () => {
      const input = {
        direction: 'row',
        first: {
          type: 'panel',
          id: 'panel-a',
          defaultSize: '200px',
        },
        second: 'panel-b',
        splitPercentage: 30,
      };
      const result = migrate(input) as any;

      // First child should keep existing defaultSize
      expect(result.children[0]).toMatchObject({
        type: 'panel',
        id: 'panel-a',
        defaultSize: '200px',
      });

      // Second child should still get the computed size
      expect(result.children[1]).toMatchObject({
        type: 'panel',
        id: 'panel-b',
        defaultSize: '70%',
      });
    });
  });

  describe('ID generation', () => {
    it('should generate ID for split nodes without id', () => {
      const input = {
        direction: 'row',
        first: 'panel-a',
        second: 'panel-b',
      };
      const result = migrate(input) as any;
      expect(result).toHaveProperty('id');
      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);
    });

    it('should generate unique IDs for nested splits', () => {
      const input = {
        direction: 'row',
        first: 'panel-a',
        second: {
          direction: 'column',
          first: 'panel-b',
          second: 'panel-c',
        },
      };
      const result = migrate(input) as any;
      expect(result.id).toBeDefined();
      expect(result.children[1].id).toBeDefined();
      expect(result.id).not.toBe(result.children[1].id);
    });

    it('should preserve existing IDs', () => {
      const input = {
        type: 'split',
        id: 'my-custom-id',
        direction: 'row',
        children: ['panel-a', 'panel-b'],
      };
      const result = migrate(input);
      expect(result).toMatchObject({
        type: 'split',
        id: 'my-custom-id',
        direction: 'row',
        children: ['panel-a', 'panel-b'],
      });
    });
  });

  describe('edge cases', () => {
    it('should handle null', () => {
      expect(migrate(null)).toBe(null);
    });

    it('should handle undefined', () => {
      expect(migrate(undefined)).toBe(undefined);
    });

    it('should handle single string panel', () => {
      expect(migrate('main')).toBe('main');
    });

    it('should handle deeply nested trees (3+ levels)', () => {
      const input = {
        direction: 'row',
        first: {
          direction: 'column',
          first: {
            direction: 'row',
            first: 'panel-a',
            second: 'panel-b',
          },
          second: 'panel-c',
        },
        second: 'panel-d',
      };
      const result = migrate(input) as any;
      expect(result.type).toBe('split');
      expect(result.children[0].type).toBe('split');
      expect(result.children[0].children[0].type).toBe('split');
      expect(result.children[0].children[0].children).toEqual([
        'panel-a',
        'panel-b',
      ]);
    });

    it('should pass through already migrated v2 configs', () => {
      const input = {
        type: 'split',
        id: 'root-split',
        direction: 'row',
        children: [
          {type: 'panel', id: 'panel-a'},
          {type: 'panel', id: 'panel-b'},
        ],
      };
      const result = migrate(input);
      expect(result).toEqual(input);
    });

    it('should handle primitives (numbers, booleans)', () => {
      expect(migrate(42)).toBe(42);
      expect(migrate(true)).toBe(true);
      expect(migrate(false)).toBe(false);
    });
  });

  describe('integration tests', () => {
    it('should convert complex real-world layout: query 30% | (table 60% / chart 40%)', () => {
      const input = {
        direction: 'row',
        first: 'query',
        second: {
          direction: 'column',
          first: 'table',
          second: 'chart',
          splitPercentage: 60,
        },
        splitPercentage: 30,
      };
      const result = migrate(input) as any;

      expect(result.type).toBe('split');
      expect(result.direction).toBe('row');
      expect(typeof result.id).toBe('string');

      expect(result.children[0]).toMatchObject({
        type: 'panel',
        id: 'query',
        defaultSize: '30%',
      });

      expect(result.children[1]).toMatchObject({
        type: 'split',
        direction: 'column',
        defaultSize: '70%',
      });

      expect(result.children[1].children[0]).toMatchObject({
        type: 'panel',
        id: 'table',
        defaultSize: '60%',
      });

      expect(result.children[1].children[1]).toMatchObject({
        type: 'panel',
        id: 'chart',
        defaultSize: '40%',
      });
    });

    it('should convert three-way split with percentages', () => {
      const input = {
        direction: 'row',
        first: 'panel-a',
        second: {
          direction: 'row',
          first: 'panel-b',
          second: 'panel-c',
          splitPercentage: 50,
        },
        splitPercentage: 33,
      };
      const result = migrate(input) as any;

      expect(result.children[0]).toMatchObject({
        type: 'panel',
        id: 'panel-a',
        defaultSize: '33%',
      });

      // Second child is a split taking 67% and dividing it 50/50
      expect(result.children[1]).toMatchObject({
        type: 'split',
        direction: 'row',
        defaultSize: '67%',
      });

      expect(result.children[1].children[0]).toMatchObject({
        type: 'panel',
        id: 'panel-b',
        defaultSize: '50%',
      });

      expect(result.children[1].children[1]).toMatchObject({
        type: 'panel',
        id: 'panel-c',
        defaultSize: '50%',
      });
    });
  });
});
