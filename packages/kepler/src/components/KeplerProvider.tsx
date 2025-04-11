import {messages} from '@kepler.gl/localization';
import {useMemo} from 'react';
import {IntlProvider} from 'react-intl';
import {ThemeProvider} from 'styled-components';
import {KeplerGlReduxState, useStoreWithKepler} from '../KeplerSlice';

import {KeplerGlContext} from '@kepler.gl/components';
import {theme} from '@kepler.gl/styles';
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
  return (
    <IntlProvider locale="en" messages={messages['en']}>
      <Provider store={reduxProviderStore}>
        <ThemeProvider theme={theme}>
          <KeplerGlContext.Provider value={keplerContext}>
            {children}
          </KeplerGlContext.Provider>
        </ThemeProvider>
      </Provider>
    </IntlProvider>
  );
};
