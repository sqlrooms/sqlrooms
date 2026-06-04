import type {DocumentAsset} from '../../DocumentsSliceConfig';

export function documentAssetToDataUrl(
  asset: DocumentAsset | undefined,
): string | undefined {
  if (!asset) return undefined;
  if (asset.encoding === 'base64') {
    return `data:${asset.mediaType};base64,${asset.data}`;
  }
  return `data:${asset.mediaType};charset=utf-8,${encodeURIComponent(
    asset.data,
  )}`;
}

export function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

export function unknownRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}
