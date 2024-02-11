import {createContext, FC, ReactNode} from 'react';

export type ErrorBoundaryProps = {
  onReset?: () => void;
  children: ReactNode;
};

export type PortalContextType = React.RefObject<HTMLElement | null> | undefined;

export type AppContextType = {
  mode: 'app' | 'sdk';
  AttributionComponent?: FC<any>;
  MapComponent?: FC<any>;
  mapProps: Record<string, any>;
  basemapCssSelector: string;
  ErrorBoundary: FC<ErrorBoundaryProps>;
  captureException: (exception: any, captureContext?: any) => void;
  portalRef: PortalContextType;
};

export const AppContext = createContext<AppContextType>({
  mode: 'app',
  MapComponent: undefined,
  AttributionComponent: undefined,
  mapProps: {},
  basemapCssSelector: '.mapboxgl-map',
  ErrorBoundary: ({children}) => <>{children}</>,
  captureException: (exception: any, captureContext?: any) => {
    console.error(exception, captureContext);
  },
  portalRef: undefined,
});
