export function getDocumentChartSettingsState(
  readOnly: boolean | undefined,
  settingsOpen: boolean | undefined,
) {
  return {
    isOpen: !readOnly && Boolean(settingsOpen),
    mountSettings: !readOnly,
  };
}
