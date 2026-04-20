import {createContext, useContext} from 'react';

const HoistedRenderersContext = createContext<string[]>([]);

export const HoistedRenderersProvider = HoistedRenderersContext.Provider;

export const useHoistedRenderers = () => useContext(HoistedRenderersContext);
