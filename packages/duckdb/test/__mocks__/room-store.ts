export * from '../../../room-store/src/BaseRoomStore';

export function useBaseRoomStore<TState, TSelected>(
  _selector: (state: TState) => TSelected,
): TSelected {
  throw new Error('useBaseRoomStore is not available in duckdb unit tests');
}
