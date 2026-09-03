import {describe, expect, test} from 'vitest';
import {getDocumentChartSettingsState} from './documentChartSettings';

describe('getDocumentChartSettingsState', () => {
  test('keeps settings closed and unmounted in read-only mode', () => {
    expect(getDocumentChartSettingsState(true, true)).toEqual({
      isOpen: false,
      mountSettings: false,
    });
  });

  test('preserves editable settings state', () => {
    expect(getDocumentChartSettingsState(false, true)).toEqual({
      isOpen: true,
      mountSettings: true,
    });
  });
});
