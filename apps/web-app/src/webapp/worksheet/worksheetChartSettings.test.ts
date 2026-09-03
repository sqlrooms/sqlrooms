import {describe, expect, test} from 'vitest';
import {getWorksheetChartSettingsState} from './worksheetChartSettings';

describe('getWorksheetChartSettingsState', () => {
  test('keeps settings closed and unmounted in read-only mode', () => {
    expect(getWorksheetChartSettingsState(true, true)).toEqual({
      isOpen: false,
      mountSettings: false,
    });
  });

  test('preserves editable settings state', () => {
    expect(getWorksheetChartSettingsState(false, true)).toEqual({
      isOpen: true,
      mountSettings: true,
    });
  });
});
