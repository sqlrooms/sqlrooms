import {
  ChakraProvider,
  Flex,
  FlexProps,
  Portal,
  useToast,
} from '@chakra-ui/react';
import createCache from '@emotion/cache';
import {CacheProvider, Global} from '@emotion/react';
import styled from '@emotion/styled';
import {
  AppContext,
  createTheme,
  customStorageManager,
  ErrorPane,
  LogoText,
  QueryContainer,
  SpinnerPane,
} from '@flowmapcity/components';
import {
  createProjectStore,
  ProjectBuilder,
  ProjectBuilderSidebarButtons,
  ProjectStateProvider,
  ProjectStore,
} from '@flowmapcity/project-builder';
import {ProjectConfig as ZodProjectConfig} from '@flowmapcity/project-config';
import * as Sentry from '@sentry/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import React, {FC, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import MapLibreComponent from 'react-map-gl/maplibre';
import {useEffectOnce} from 'react-use';
import {fromZodError} from 'zod-validation-error';
import {
  DataSource,
  ProjectConfig,
  UrlDataSource,
} from './project-config/ProjectConfig';
// import mapboxCss from '../../../node_modules/mapbox-gl/dist/mapbox-gl.css?inline';
import maplibReglCss from '../../../node_modules/maplibre-gl/dist/maplibre-gl.css?inline';
import mosaicCss from '../../../node_modules/react-mosaic-component/react-mosaic-component.css?inline';

const SERVER_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:4444'
    : 'https://app.flowmap.city';

/**
 * Defines the properties that can be passed to the FlowmapCity constructor.
 */
export interface FlowmapCityProps {
  /**
   * Flowmap City access token
   */
  accessToken: string;
  /**
   * The container element to render FlowmapCity into
   */
  container: HTMLElement | null;
  /**
   * The configuration of the project
   */
  config: ProjectConfig;
  /**
   * Options for the project
   */
  options?: {
    /** If true, project configuration properties won't be editable */
    readOnly?: boolean;
    /** If true, the sidebar won't be shown */
    showSidebar?: boolean;
  };
}

/**
 * The FlowmapCity class is the main entry point for the Flowmap City SDK.
 */
export default class FlowmapCity {
  private _projectStore: ProjectStore;
  private _initialized: Promise<void> | undefined = undefined;

  /**
   * Create a new FlowmapCity instance
   */
  constructor(props: FlowmapCityProps) {
    const {accessToken, container, config, options} = props;
    const parsedConfig = ZodProjectConfig.safeParse(config);
    if (!parsedConfig.success) {
      throw new Error(fromZodError(parsedConfig.error).message);
    }
    this._projectStore = createProjectStore();
    if (!container) return;
    const shadowRoot =
      // Avoid creating a new shadow root if one already exists
      // (e.g. when calling FlowmapCity multiple times on the same container,
      // e.g. when using React.StrictMode)
      container.attachShadow({mode: 'closed'});

    // addStyles(shadowRoot, `${mosaicCss}`);
    addStyles(shadowRoot, `${maplibReglCss}`);
    const root = createRoot(shadowRoot);
    const myCache = createCache({
      container: shadowRoot,
      key: 'fmc',
    });
    this._initialized = this._initializeAsync(parsedConfig.data, options);
    root.render(
      // <React.StrictMode>
      <CacheProvider value={myCache}>
        <Global styles={mosaicCss} />
        {/*<Global styles={mapboxCss} /> */}
        <Global
          styles={`
            .maplibregl-ctrl-attrib a { color: unset !important; }
            .maplibregl-ctrl.maplibregl-ctrl-attrib { background-color: unset !important; }
          `}
        />
        <ProjectStateProvider projectStore={this._projectStore}>
          <SdkMain accessToken={accessToken} options={options} />
        </ProjectStateProvider>
      </CacheProvider>,
      // </React.StrictMode>,
    );
  }

  private async _initializeAsync(
    config: ZodProjectConfig,
    options: FlowmapCityProps['options'],
  ): Promise<void> {
    await this._projectStore.getState().reinitialize({
      project: {id: '', config},
      isReadOnly: Boolean(options?.readOnly),
      captureException,
    });
  }

  async addDataSource(dataSource: ObjectsDataSource | UrlDataSource) {
    await this._initialized;
    const projectStore = this._projectStore.getState();
    if (isObjectsDataSource(dataSource)) {
      projectStore.addTable(dataSource.tableName, dataSource.data);
    } else {
      projectStore.addDataSource(dataSource);
    }
  }
}

export type ObjectsDataSource = {
  tableName: string;
  data: Record<string, unknown>[];
};

function isObjectsDataSource(
  dataSource: ObjectsDataSource | DataSource,
): dataSource is ObjectsDataSource {
  return Array.isArray((dataSource as ObjectsDataSource).data);
}

const theme = createTheme({
  body: 'Trebuchet MS, Arial, sans-serif',
  heading: 'Trebuchet MS, Arial, sans-serif',
  mono: 'Menlo, monospace',
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // retry: 0,
      // staleTime: Infinity,
      suspense: true,
    },
  },
});

// TODO: init Sentry in the SDK
// Sentry.init({
//   dsn: '',
// })
const captureException = Sentry.captureException;
const DEFAULT_MAPLIBRE_STYLE =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// const MapComponent: FC<any> = ({
//   mapStyle = DEFAULT_MAPLIBRE_STYLE,
//   children,
//   ...rest
// }) => (
//   <MapLibreComponent
//     // mapLib={import('maplibre-gl')}
//     mapStyle={mapStyle}
//     {...rest}
//   >
//     {children}
//     <AttributionControl customAttribution="Flowmap City" />
//   </MapLibreComponent>
// );

const StyledOuter = styled.div`
  color: white;
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 500px;
  min-height: 300px;
  border: 1px solid #222;
`;

const StyledMainContainer = styled.div(
  ({theme}: {theme: Record<string, any>}) => `
  position: absolute;
  width: 100%;
  height: 100%;
  font-family: ${theme.fonts.body};
  overflow: hidden;
  & > .chakra-portal {    
    width: 100%;
    height: 100%;
  }
`,
);

const StyledPortalContainer = styled.div(
  ({theme}: {theme: Record<string, any>}) => `
  position: absolute;
  font-family: ${theme.fonts.body};
`,
);

const colorModeManager = customStorageManager(true);

type SdkErrorBoundaryProps = {
  width?: FlexProps['width'];
  height?: FlexProps['height'];
  errorPaneActions?: boolean;
  onReset?: () => void;
  children: React.ReactNode;
};

const SdkErrorBoundary: FC<SdkErrorBoundaryProps> = (props) => {
  const {onReset, errorPaneActions = false, children, ...rest} = props;
  return (
    <Sentry.ErrorBoundary
      fallback={({error, resetError}) => {
        return (
          <Flex
            mx="auto"
            alignItems="center"
            justifyContent="center"
            height="100%"
            width="100%"
            {...rest}
          >
            <div>
              <ErrorPane
                actions={errorPaneActions}
                {...(onReset
                  ? {
                      onRetry: () => {
                        resetError();
                        onReset();
                      },
                    }
                  : null)}
              />
            </div>
          </Flex>
        );
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
};

const DISABLE_DELAY = 10000;

const SdkMain: React.FC<{
  accessToken: string;
  options: FlowmapCityProps['options'];
}> = ({accessToken, options}) => {
  const {showSidebar = true} = options ?? {};
  const toast = useToast();
  const [invalidAccessToken, setInvalidAccessToken] = useState(false);
  const [isDisabled, setDisabled] = useState(false);
  useEffectOnce(() => {
    (async () => {
      const {verified, valid: status} = await verifyToken(accessToken);
      if (!status) {
        if (verified) {
          setInvalidAccessToken(true);
          setTimeout(() => {
            setDisabled(true);
          }, DISABLE_DELAY);
        }
        toast.closeAll();
        toast({
          ...(verified
            ? {
                title: 'Invalid Flowmap City SDK access token',
                description: 'Please check the access token and try again.',
              }
            : {
                title: `Flowmap City SDK access token couldn't be verified`,
                description: '',
              }),
          status: 'error',
          duration: null,
          isClosable: false,
          position: 'top',
        });
      }
    })();
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const portalProps = useMemo(
    () => ({portalProps: {containerRef: portalRef}}),
    [portalRef],
  );
  return (
    <>
      <ChakraProvider
        theme={theme}
        colorModeManager={colorModeManager}
        disableGlobalStyle={false}
        toastOptions={portalProps}
        //cssVarsRoot=":host,:root"
      >
        <Portal containerRef={containerRef}>
          {isDisabled ? null : (
            <AppContext.Provider
              value={{
                mode: 'sdk',
                captureException, // TODO: add Sentry
                ErrorBoundary: SdkErrorBoundary,
                portalRef,
                mapProps: {
                  mapStyle: DEFAULT_MAPLIBRE_STYLE,
                },
                AttributionComponent: () => (
                  <Flex
                    opacity={0.75}
                    transition="opacity 0.2s, filter 0.2s"
                    _hover={{opacity: 1, filter: 'saturate(1)'}}
                    filter="saturate(0.3)"
                    cursor="pointer"
                    onClick={() =>
                      window.open('https://flowmap.city', '_blank')
                    }
                  >
                    <LogoText />
                    {/* <Logo width={16} height={16} />
                    <Text fontWeight="bold" fontSize={14}>
                      Flowmap City
                    </Text> */}
                  </Flex>
                ),
                MapComponent: MapLibreComponent,
                basemapCssSelector: '.maplibregl-map',
              }}
            >
              <QueryClientProvider client={queryClient}>
                <QueryContainer
                  // TODO: add error boundary
                  embedded={false}
                  loading={<SpinnerPane h="100vh" />}
                >
                  <Flex flexDir="row" flexGrow={1} w="100%" h="100%">
                    {showSidebar ? <ProjectBuilderSidebarButtons /> : null}
                    <ProjectBuilder />
                  </Flex>
                </QueryContainer>
              </QueryClientProvider>
            </AppContext.Provider>
          )}
        </Portal>
        <StyledOuter>
          <StyledMainContainer
            ref={containerRef}
            data-theme="dark"
            className="main-container chakra-ui-dark"
            theme={theme}
            style={
              invalidAccessToken
                ? {
                    transition: `all ${DISABLE_DELAY}ms`,
                    opacity: 0,
                    filter: 'blur(5px) hue-rotate(90deg)',
                    pointerEvents: 'none',
                  }
                : undefined
            }
          />
          <StyledPortalContainer
            ref={portalRef}
            data-theme="dark"
            className="portal-container chakra-ui-dark"
            theme={theme}
          />
        </StyledOuter>
      </ChakraProvider>
    </>
  );
};

function addStyles(node: HTMLElement | ShadowRoot, styles: string) {
  const styleNode = document.createElement('style');
  styleNode.innerHTML = styles;
  node.appendChild(styleNode);
}

async function verifyToken(accessToken: string): Promise<{
  verified: boolean;
  valid?: string;
}> {
  try {
    const result = await fetch(`${SERVER_URL}/api/auth/verify-token`, {
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({token: accessToken}),
      method: 'POST',
      mode: 'cors',
    });
    if (!result.ok) {
      return {verified: false};
    }
    const json = await result.json();
    return {verified: true, valid: json.valid};
  } catch (e) {
    return {verified: false};
  }
}
