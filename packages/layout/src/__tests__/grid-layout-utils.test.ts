import {
  expandGridLayoutItemHorizontally,
  expandGridLayoutsItemHorizontally,
  isGridLayoutsItemHorizontallyExpanded,
  shrinkGridLayoutItemHorizontally,
  shrinkGridLayoutsItemHorizontally,
} from '../grid-layout-utils';

describe('grid-layout-utils', () => {
  describe('expandGridLayoutItemHorizontally', () => {
    it('expands an item to the free horizontal space between row blockers', () => {
      const result = expandGridLayoutItemHorizontally(
        [
          {i: 'left', x: 0, y: 0, w: 2, h: 2},
          {i: 'target', x: 3, y: 0, w: 2, h: 2},
          {i: 'right', x: 8, y: 0, w: 2, h: 2},
          {i: 'below', x: 0, y: 2, w: 12, h: 1},
        ],
        'target',
        12,
      );

      expect(result.changed).toBe(true);
      expect(result.layout.find((item) => item.i === 'target')).toMatchObject({
        x: 2,
        w: 6,
      });
    });

    it('uses vertically overlapping panels as blockers', () => {
      const result = expandGridLayoutItemHorizontally(
        [
          {i: 'target', x: 3, y: 1, w: 2, h: 2},
          {i: 'above', x: 0, y: 0, w: 12, h: 1},
          {i: 'overlapping-left', x: 0, y: 2, w: 2, h: 2},
        ],
        'target',
        12,
      );

      expect(result.layout.find((item) => item.i === 'target')).toMatchObject({
        x: 2,
        w: 10,
      });
    });

    it('expands to the full row when no panels block the item', () => {
      const result = expandGridLayoutItemHorizontally(
        [
          {i: 'target', x: 3, y: 1, w: 2, h: 2},
          {i: 'above', x: 0, y: 0, w: 12, h: 1},
          {i: 'below', x: 0, y: 3, w: 12, h: 1},
        ],
        'target',
        12,
      );

      expect(result.layout.find((item) => item.i === 'target')).toMatchObject({
        x: 0,
        w: 12,
      });
    });
  });

  describe('expandGridLayoutsItemHorizontally', () => {
    it('expands the item in each responsive layout', () => {
      const result = expandGridLayoutsItemHorizontally(
        {
          lg: [
            {i: 'target', x: 3, y: 0, w: 2, h: 2},
            {i: 'right', x: 8, y: 0, w: 2, h: 2},
          ],
          sm: [
            {i: 'target', x: 1, y: 0, w: 2, h: 2},
            {i: 'right', x: 4, y: 0, w: 1, h: 2},
          ],
        },
        'target',
        {lg: 12, sm: 6},
      );

      expect(result.changed).toBe(true);
      expect(
        result.layouts.lg?.find((item) => item.i === 'target'),
      ).toMatchObject({
        x: 0,
        w: 8,
      });
      expect(
        result.layouts.sm?.find((item) => item.i === 'target'),
      ).toMatchObject({
        x: 0,
        w: 4,
      });
    });
  });

  describe('shrinkGridLayoutItemHorizontally', () => {
    it('shrinks an expanded item to half of its available horizontal space', () => {
      const result = shrinkGridLayoutItemHorizontally(
        [
          {i: 'target', x: 0, y: 0, w: 12, h: 2},
          {i: 'below', x: 0, y: 2, w: 12, h: 1},
        ],
        'target',
        12,
      );

      expect(result.changed).toBe(true);
      expect(result.layout.find((item) => item.i === 'target')).toMatchObject({
        x: 0,
        w: 6,
      });
    });

    it('shrinks to half of the row segment between blockers', () => {
      const result = shrinkGridLayoutItemHorizontally(
        [
          {i: 'left', x: 0, y: 0, w: 2, h: 2},
          {i: 'target', x: 2, y: 0, w: 6, h: 2},
          {i: 'right', x: 8, y: 0, w: 2, h: 2},
        ],
        'target',
        12,
      );

      expect(result.layout.find((item) => item.i === 'target')).toMatchObject({
        x: 2,
        w: 3,
      });
    });

    it('moves a non-leftmost item to the row segment start when shrinking', () => {
      const result = shrinkGridLayoutItemHorizontally(
        [{i: 'target', x: 6, y: 0, w: 6, h: 2}],
        'target',
        12,
      );

      expect(result.changed).toBe(true);
      expect(result.layout.find((item) => item.i === 'target')).toMatchObject({
        x: 0,
        w: 6,
      });
    });
  });

  describe('shrinkGridLayoutsItemHorizontally', () => {
    it('shrinks the item in each responsive layout', () => {
      const layouts = {
        lg: [{i: 'target', x: 0, y: 0, w: 12, h: 2}],
        sm: [{i: 'target', x: 0, y: 0, w: 6, h: 2}],
      };

      expect(
        isGridLayoutsItemHorizontallyExpanded(layouts, 'target', {
          lg: 12,
          sm: 6,
        }),
      ).toBe(true);

      const result = shrinkGridLayoutsItemHorizontally(layouts, 'target', {
        lg: 12,
        sm: 6,
      });

      expect(result.changed).toBe(true);
      expect(
        result.layouts.lg?.find((item) => item.i === 'target'),
      ).toMatchObject({w: 6});
      expect(
        result.layouts.sm?.find((item) => item.i === 'target'),
      ).toMatchObject({w: 3});
    });

    it('uses breakpoint defaults when responsive cols omit a layout breakpoint', () => {
      const layouts = {
        sm: [{i: 'target', x: 0, y: 0, w: 6, h: 2}],
      };

      expect(
        isGridLayoutsItemHorizontallyExpanded(layouts, 'target', {lg: 12}),
      ).toBe(true);

      const result = shrinkGridLayoutsItemHorizontally(layouts, 'target', {
        lg: 12,
      });

      expect(
        result.layouts.sm?.find((item) => item.i === 'target'),
      ).toMatchObject({w: 3});
    });
  });
});
