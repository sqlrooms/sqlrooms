export type ParsedByteRange = {
  range: {
    offset: number;
    length?: number;
  };
  contentRange: string;
};

export function parseByteRangeHeader(
  rangeHeader: string | null,
  sizeBytes: number,
): ParsedByteRange | null {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match || !Number.isFinite(sizeBytes) || sizeBytes < 0) return null;

  const [, startRaw, endRaw] = match;
  if (!startRaw && !endRaw) return null;

  if (!startRaw) {
    const suffixLength = Number.parseInt(endRaw, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    const length = Math.min(suffixLength, sizeBytes);
    const offset = Math.max(sizeBytes - length, 0);
    return {
      range: {offset, length},
      contentRange: `bytes ${offset}-${offset + length - 1}/${sizeBytes}`,
    };
  }

  const offset = Number.parseInt(startRaw, 10);
  if (!Number.isFinite(offset) || offset < 0 || offset >= sizeBytes) {
    return null;
  }

  if (!endRaw) {
    return {
      range: {offset},
      contentRange: `bytes ${offset}-${sizeBytes - 1}/${sizeBytes}`,
    };
  }

  const end = Number.parseInt(endRaw, 10);
  if (!Number.isFinite(end) || end < offset) return null;

  const boundedEnd = Math.min(end, sizeBytes - 1);
  return {
    range: {offset, length: boundedEnd - offset + 1},
    contentRange: `bytes ${offset}-${boundedEnd}/${sizeBytes}`,
  };
}
