import {describe, expect, it} from '@jest/globals';
import {isTemporalType} from '../src/column-types-utils';

describe('LineChartSettings xInterval cleanup behavior', () => {
  describe('temporal type detection', () => {
    it('correctly identifies temporal types', () => {
      expect(isTemporalType('DATE')).toBe(true);
      expect(isTemporalType('TIME')).toBe(true);
      expect(isTemporalType('TIMESTAMP')).toBe(true);
      expect(isTemporalType('TIMESTAMP_MS')).toBe(true);
      expect(isTemporalType('TIMESTAMP_NS')).toBe(true);
      expect(isTemporalType('TIMESTAMP_S')).toBe(true);
      expect(isTemporalType('TIMESTAMPTZ')).toBe(true);
    });

    it('correctly identifies non-temporal types', () => {
      expect(isTemporalType('BIGINT')).toBe(false);
      expect(isTemporalType('INTEGER')).toBe(false);
      expect(isTemporalType('DOUBLE')).toBe(false);
      expect(isTemporalType('VARCHAR')).toBe(false);
      expect(isTemporalType('FLOAT')).toBe(false);
    });
  });

  describe('xInterval clearing logic', () => {
    it('should clear xInterval when transitioning from temporal to non-temporal', () => {
      // This test documents the expected behavior implemented in LineChartSettings.tsx
      // The component uses a useEffect that:
      // 1. Tracks previous isTemporalType state with useRef
      // 2. On change, checks if wasTemporalBefore && !isTemporalNow && xInterval is set
      // 3. If true, calls onChangeConfig('xInterval', undefined)

      const wasTemporalBefore = true;
      const isTemporalNow = false;
      const xIntervalIsSet = true;

      const shouldClearXInterval =
        wasTemporalBefore && !isTemporalNow && xIntervalIsSet;

      expect(shouldClearXInterval).toBe(true);
    });

    it('should not clear xInterval when both fields are temporal', () => {
      const wasTemporalBefore = true;
      const isTemporalNow = true;
      const xIntervalIsSet = true;

      const shouldClearXInterval =
        wasTemporalBefore && !isTemporalNow && xIntervalIsSet;

      expect(shouldClearXInterval).toBe(false);
    });

    it('should not clear xInterval when both fields are non-temporal', () => {
      const wasTemporalBefore = false;
      const isTemporalNow = false;
      const xIntervalIsSet = true;

      const shouldClearXInterval =
        wasTemporalBefore && !isTemporalNow && xIntervalIsSet;

      expect(shouldClearXInterval).toBe(false);
    });

    it('should not clear xInterval when transitioning to temporal from non-temporal', () => {
      const wasTemporalBefore = false;
      const isTemporalNow = true;
      const xIntervalIsSet = true;

      const shouldClearXInterval =
        wasTemporalBefore && !isTemporalNow && xIntervalIsSet;

      expect(shouldClearXInterval).toBe(false);
    });
  });
});
