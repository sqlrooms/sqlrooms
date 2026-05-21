import {Query} from '@uwdata/mosaic-sql';

/** Wrap query function to inject maxDataPoints metadata for validation. */
export function wrapQueryWithMaxDataPoints(
  query: (filter: unknown) => ReturnType<typeof Query.from>,
  maxDataPoints: number | undefined,
): (filter: unknown) => ReturnType<typeof Query.from> {
  if (maxDataPoints === undefined) {
    return query;
  }
  return (filter: unknown) => {
    const baseQuery = query(filter);
    (baseQuery as any).__maxDataPoints = maxDataPoints;
    return baseQuery;
  };
}
