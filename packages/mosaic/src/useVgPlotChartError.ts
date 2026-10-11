import {useCallback, useState} from 'react';

export type ErrorState = {
  error: Error;
  specKey: string;
} | null;

/**
 * Hook to manage chart error state.
 * Error messages are scoped to the current spec - when spec changes, old errors are cleared.
 */
export function useVgPlotChartError(specKey: string | null) {
  const [errorState, setErrorState] = useState<ErrorState>(null);

  // Return error state only if it matches current spec
  const currentError =
    errorState?.specKey === specKey ? errorState.error : null;

  const setError = useCallback(
    (error: Error) => {
      setErrorState({
        error,
        specKey: specKey ?? '',
      });
    },
    [specKey],
  );

  return {error: currentError, setError};
}
