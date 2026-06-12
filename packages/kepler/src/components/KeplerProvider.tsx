import {messages} from '@kepler.gl/localization';
import {PropsWithChildren, useMemo} from 'react';
import {IntlProvider} from 'react-intl';
import {ThemeProvider, StyleSheetManager} from 'styled-components';
import {KeplerGlReduxState, useStoreWithKepler} from '../KeplerSlice';

import {KeplerGlContext, shouldForwardProp} from '@kepler.gl/components';
import {darkTheme} from '../styles/theme';
import {Provider} from 'react-redux';

type KeplerProviderProps = PropsWithChildren<{
  mapId: string;
}>;

// Provide intl, theme, context, and redux store to the kepler
export const KeplerProvider: React.FC<KeplerProviderProps> = ({
  children,
  mapId,
}) => {
  const reduxProviderStore = useStoreWithKepler(
    (state) => state.kepler.__reduxProviderStore,
  );
  const basicKeplerProps = useStoreWithKepler(
    (state) => state.kepler.basicKeplerProps,
  );

  // Merge modal z-index override into the kepler theme so react-modal picks it up
  const modalOverlayZIndex = basicKeplerProps?.modalOverlayZIndex;
  const resolvedTheme = useMemo(() => {
    if (modalOverlayZIndex == null) return darkTheme;
    return {...darkTheme, modalOverLayZ: modalOverlayZIndex};
  }, [modalOverlayZIndex]);

  const keplerContext = useMemo(
    () => ({
      selector: (state: KeplerGlReduxState) => state[mapId],
      id: mapId,
    }),
    [mapId],
  );
  if (!reduxProviderStore) {
    return null;
  }
  return (
    <IntlProvider locale="en" messages={messages['en']}>
      <Provider store={reduxProviderStore}>
        <StyleSheetManager shouldForwardProp={shouldForwardProp}>
          <ThemeProvider theme={resolvedTheme}>
            <KeplerGlContext.Provider value={keplerContext}>
              <>{children}</>
            </KeplerGlContext.Provider>
          </ThemeProvider>
        </StyleSheetManager>
      </Provider>
    </IntlProvider>
  );
};
