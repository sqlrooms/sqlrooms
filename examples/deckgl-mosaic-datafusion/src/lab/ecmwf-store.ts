import * as zarr from 'zarrita';
import {ECMWF_STORE_URL} from './types';

/**
 * Shared handle to the public ECMWF Zarr store. Every consumer (time cube,
 * deck.gl raster tiles) goes through these memoized opens so the
 * consolidated metadata is fetched once per page load.
 */
let groupPromise: Promise<zarr.Group<zarr.Readable>> | null = null;
const arrayPromises = new Map<
  string,
  Promise<zarr.Array<zarr.DataType, zarr.Readable>>
>();

export function openEcmwfGroup() {
  groupPromise ??= (async () => {
    const store = await zarr.withConsolidatedMetadata(
      new zarr.FetchStore(ECMWF_STORE_URL),
      {format: 'v3'},
    );
    return zarr.open.v3(store, {kind: 'group'});
  })();
  return groupPromise;
}

export function openEcmwfArray(variable: string) {
  let promise = arrayPromises.get(variable);
  if (!promise) {
    promise = openEcmwfGroup().then((group) =>
      zarr.open.v3(group.resolve(variable), {kind: 'array'}),
    );
    arrayPromises.set(variable, promise);
  }
  return promise;
}
