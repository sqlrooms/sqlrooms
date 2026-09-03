export function getWorksheetChartSettingsState(
  readOnly: boolean | undefined,
  settingsOpen: boolean | undefined,
) {
  return {
    isOpen: !readOnly && Boolean(settingsOpen),
    mountSettings: !readOnly,
  };
}
