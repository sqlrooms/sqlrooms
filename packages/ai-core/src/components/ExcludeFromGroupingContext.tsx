import {createContext, useContext} from 'react';

const ExcludeFromGroupingContext = createContext<string[]>([]);

export const ExcludeFromGroupingProvider = ExcludeFromGroupingContext.Provider;

export const useExcludeFromGrouping = () =>
  useContext(ExcludeFromGroupingContext);
