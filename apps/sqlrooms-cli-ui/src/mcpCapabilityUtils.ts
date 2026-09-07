export function likePatternToRegex(pattern: string) {
  const normalized = pattern.replace(/%+/g, '%');
  const wildcardCount = (normalized.match(/[%_]/g) ?? []).length;
  if (wildcardCount > 20) {
    throw new Error('Table pattern contains too many wildcards.');
  }
  const escaped = normalized
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/%/g, '.*')
    .replace(/_/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}
