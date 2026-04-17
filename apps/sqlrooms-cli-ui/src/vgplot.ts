import {getErrorMessage} from './utils';

export function parseVgPlotSpecString(vgplot: string): {
  parsed: Record<string, unknown>;
  formatted: string;
} {
  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(vgplot);
  } catch (error) {
    throw new Error(
      `VgPlot spec must be valid JSON. ${getErrorMessage(error)}`,
    );
  }
  if (
    typeof parsedValue !== 'object' ||
    parsedValue === null ||
    Array.isArray(parsedValue)
  ) {
    throw new Error('VgPlot spec must be a JSON object.');
  }
  return {
    parsed: parsedValue as Record<string, unknown>,
    formatted: JSON.stringify(parsedValue, null, 2),
  };
}

export function toVgPlotSpecString(
  vgplot: string | Record<string, unknown>,
): string {
  return typeof vgplot === 'string' ? vgplot : JSON.stringify(vgplot, null, 2);
}
