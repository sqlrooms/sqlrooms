export function generateUniqueName(
  baseName: string,
  existingNames: string[],
): string {
  if (!existingNames.includes(baseName)) {
    return baseName;
  }

  let suffix = 1;
  let candidate = `${baseName} ${suffix}`;
  while (existingNames.includes(candidate)) {
    suffix += 1;
    candidate = `${baseName} ${suffix}`;
  }
  return candidate;
}
