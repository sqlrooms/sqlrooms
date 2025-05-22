import {messages} from '@kepler.gl/localization';
import {useMemo} from 'react';
import {IntlProvider} from 'react-intl';
import {ThemeProvider, StyleSheetManager} from 'styled-components';
import {KeplerGlReduxState, useStoreWithKepler} from '../KeplerSlice';

import {KeplerGlContext, shouldForwardProp} from '@kepler.gl/components';
import {darkTheme} from '../styles/theme';
import {Provider} from 'react-redux';

type KeplerProviderProps = {
  children: React.ReactNode;
  mapId: string;
};

// Provide intl, theme, context, and redux store to the kepler
export const KeplerProvider: React.FC<KeplerProviderProps> = ({
  children,
  mapId,
}) => {
  const reduxProviderStore = useStoreWithKepler(
    (state) => state.kepler.__reduxProviderStore,
  );

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
          <ThemeProvider theme={darkTheme}>
            <KeplerGlContext.Provider value={keplerContext}>
              {children}
            </KeplerGlContext.Provider>
          </ThemeProvider>
        </StyleSheetManager>
      </Provider>
    </IntlProvider>
  );
};
