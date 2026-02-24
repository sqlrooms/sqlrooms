let counter = 0;

export function createId(): string {
  counter += 1;
  return `mock-cuid-${counter}`;
}
