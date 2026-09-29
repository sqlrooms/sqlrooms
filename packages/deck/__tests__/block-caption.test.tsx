import {describe, expect, jest, test} from '@jest/globals';
import {createBaseRoomSlice, RoomStateProvider} from '@sqlrooms/room-store';
import {TooltipProvider} from '@sqlrooms/ui';
import {BlockCaptionEditor} from '../../documents/src/components/BlockCaptionEditor';
import {BlockHeader} from '../../documents/src/components/BlockHeader';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {createStore} from 'zustand/vanilla';
import {createDeckMapsSlice} from '../src/DeckMapsSlice';

// The real caption/header primitives: this suite is about whether the map
// block renders the same chrome the chart block does.
jest.unstable_mockModule('@sqlrooms/documents', () => ({
  useBlockSettingsStore: () => undefined,
  BlockCaptionEditor,
  BlockHeader,
  DataTableSelectorEmptyState: () => null,
}));
jest.unstable_mockModule('../src/DeckMapSurface', () => ({
  DeckMapSurface: () => null,
  directDeckMapDataAdapter: {},
}));

const {DeckMapBlockRenderer} = await import('../src/block');

function renderToContainer(node: React.ReactNode) {
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(node));
  return {container, unmount: () => act(() => root.unmount())};
}

function renderMapBlock(
  caption?: string,
  onCaptionChange?: (value: string | undefined) => void,
) {
  const store = createStore((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createDeckMapsSlice({
      config: {
        mapsById: {
          map: {
            id: 'map',
            title: 'Embedded Map',
            config: {spec: {layers: []}, datasets: {}},
          },
        },
      },
    })(...args),
    db: {tables: []},
  }));
  return renderToContainer(
    <RoomStateProvider roomStore={store}>
      <TooltipProvider>
        <DeckMapBlockRenderer
          mapId="map"
          caption={caption}
          onCaptionChange={onCaptionChange}
        />
      </TooltipProvider>
    </RoomStateProvider>,
  );
}

describe('document map block caption', () => {
  test('uses the shared block caption styling so it matches chart captions', () => {
    const map = renderMapBlock('My map');
    const reference = renderToContainer(
      <BlockCaptionEditor value="My map" onChange={() => {}} />,
    );
    try {
      const mapCaption = map.container.querySelector('input');
      const referenceCaption = reference.container.querySelector('input');
      expect(mapCaption).not.toBeNull();
      expect(referenceCaption).not.toBeNull();
      expect(mapCaption!.className).toBe(referenceCaption!.className);
    } finally {
      map.unmount();
      reference.unmount();
    }
  });

  test('renders the block header with the same chrome as other block headers', () => {
    const map = renderMapBlock();
    const reference = renderToContainer(<BlockHeader>caption</BlockHeader>);
    try {
      // The map header keeps a leading MapIcon, so the caption sits one level
      // deeper than the chart's; the header itself is the block's first child.
      const header = map.container.firstElementChild!.firstElementChild!;
      expect(header.querySelector('input')).not.toBeNull();
      expect(header.className).toBe(
        reference.container.firstElementChild!.className,
      );
    } finally {
      map.unmount();
      reference.unmount();
    }
  });

  test('does not write the map title into an untouched caption', () => {
    const onCaptionChange = jest.fn();
    const {container, unmount} = renderMapBlock(undefined, onCaptionChange);
    try {
      const input = container.querySelector('input')!;
      // The map's own title shows as the heading until the block is captioned,
      // and an agent can set it to something meaningful. Focusing and leaving
      // must not freeze it into the document's caption attribute.
      expect(input.value).toBe('Embedded Map');
      // React maps onBlur onto the bubbling `focusout` event.
      act(() => {
        input.dispatchEvent(new FocusEvent('focusout', {bubbles: true}));
      });
      expect(onCaptionChange).not.toHaveBeenCalled();
    } finally {
      unmount();
    }
  });
});
