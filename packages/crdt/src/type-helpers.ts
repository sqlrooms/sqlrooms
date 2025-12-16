import {SchemaType, InferType} from 'loro-mirror';
import {StateCreator, StoreApi} from 'zustand';

export type StoreSet<S> = Parameters<StateCreator<S>>[0];
export type StoreGet<S> = Parameters<StateCreator<S>>[1];

export type MirrorSchema<T extends SchemaType = SchemaType> = T;

/**
 * `loro-mirror` injects internal `$cid` metadata into mirrored map objects.
 *
 * Store state typically doesn't include `$cid`, so binding `select()` functions
 * naturally return the same shape *minus* `$cid`. This helper strips `$cid`
 * recursively so `select()` can be type-safe without forcing `any` casts.
 */
export type StripCidDeep<T> = T extends (infer U)[]
  ? StripCidDeep<U>[]
  : T extends Record<string, any>
    ? T extends {$cid: any}
      ? Omit<{[K in keyof T]: StripCidDeep<T[K]>}, '$cid'>
      : {[K in keyof T]: StripCidDeep<T[K]>}
    : T;

export type InferredState<TSchema extends SchemaType> =
  InferType<TSchema> extends Record<string, any>
    ? InferType<TSchema>
    : Record<string, never>;

/**
 * Local equivalent of `createSlice` from `@sqlrooms/room-store`.
 *
 * Kept inline so `@sqlrooms/crdt` stays dependency-light (no need to depend on
 * `@sqlrooms/room-store` just for a typing helper).
 */
export function createSlice<
  SliceState,
  StoreState extends SliceState = SliceState,
>(
  sliceCreator: (...args: Parameters<StateCreator<StoreState>>) => SliceState,
): StateCreator<SliceState> {
  return (set, get, store) =>
    sliceCreator(set, get as () => StoreState, store as StoreApi<StoreState>);
}
