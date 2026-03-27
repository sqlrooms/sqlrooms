import {CreateLayoutSliceProps} from '@sqlrooms/layout';
import {SpinnerPane} from '@sqlrooms/ui';
import {DatabaseIcon} from 'lucide-react';
import {createElement, Suspense} from 'react';
import {z} from 'zod';
import {DataSourcesPanel} from './components/DataSourcesPanel';
import {MainView} from './components/MainView';

export const RoomPanelTypes = z.enum(['data-sources', 'main'] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

export const LAYOUT: CreateLayoutSliceProps = {
  config: {
    type: 'split',
    direction: 'row',
    children: [RoomPanelTypes.enum['data-sources'], 'main'],
    splitPercentages: [20, 80],
  },
  panels: {
    [RoomPanelTypes.enum['data-sources']]: {
      title: 'Data Sources',
      icon: DatabaseIcon,
      component: DataSourcesPanel,
      placement: 'sidebar',
    },
    // [RoomPanelTypes.enum.assistant]: {
    //   title: 'Assistant',
    //   icon: () => null,
    //   component: AssistantPanel,
    //   placement: 'sidebar',
    // },
    main: {
      title: 'Main view',
      icon: () => null,
      component: () =>
        createElement(Suspense, {
          fallback: createElement(SpinnerPane, {
            className: 'h-full w-full',
          }),
          children: createElement(MainView),
        }),
      placement: 'main',
    },
  },
};
