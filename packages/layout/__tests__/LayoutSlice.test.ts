import {createStore} from 'zustand';
import {
  createLayoutSlice,
  LayoutSliceState,
  RoomPanelInfo,
} from '../src/LayoutSlice';
import {createBaseRoomSlice, BaseRoomStoreState} from '@sqlrooms/room-store';
import {MAIN_VIEW} from '@sqlrooms/layout-config';

type TestStoreState = BaseRoomStoreState & LayoutSliceState;

const mockPanels: Record<string, RoomPanelInfo> = {
  sidebar1: {
    title: 'Sidebar 1',
    component: () => null,
    placement: 'sidebar',
  },
  sidebar2: {
    title: 'Sidebar 2',
    component: () => null,
    placement: 'sidebar',
  },
  sidebarBottom: {
    title: 'Sidebar Bottom',
    component: () => null,
    placement: 'sidebar-bottom',
  },
  mainPanel: {
    title: 'Main Panel',
    component: () => null,
    placement: 'main',
  },
};

function createTestStore(panels = mockPanels) {
  return createStore<TestStoreState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createLayoutSlice({panels})(...args),
  }));
}

describe('LayoutSlice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(async () => {
    store = createTestStore();
    await store.getState().layout.initialize?.();
  });

  afterEach(async () => {
    await store.getState().layout.destroy?.();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const config = store.getState().layout.config;
      expect(config).toBeDefined();
      expect(config.nodes).toBeDefined();
    });

    it('should initialize with provided panels', () => {
      const panels = store.getState().layout.panels;
      expect(Object.keys(panels).length).toBe(4);
      expect(panels['sidebar1']).toBeDefined();
    });
  });

  describe('setConfig', () => {
    it('should update layout config', () => {
      const newConfig = {
        nodes: 'new-panel',
        pinned: [],
        fixed: [],
      };

      store.getState().layout.setConfig(newConfig);

      expect(store.getState().layout.config.nodes).toBe('new-panel');
    });
  });

  describe('setLayout (deprecated)', () => {
    it('should call setConfig', () => {
      const newConfig = {
        nodes: 'test-panel',
        pinned: [],
        fixed: [],
      };

      store.getState().layout.setLayout(newConfig);

      expect(store.getState().layout.config.nodes).toBe('test-panel');
    });
  });

  describe('togglePanel', () => {
    it('should show hidden panel', () => {
      const config = store.getState().layout.config;

      // Hide sidebar1 first by setting config without it
      store.getState().layout.setConfig({
        nodes: MAIN_VIEW,
        pinned: [],
        fixed: [],
      });

      // Now toggle to show it
      store.getState().layout.togglePanel('sidebar1', true);

      const newConfig = store.getState().layout.config;
      expect(JSON.stringify(newConfig.nodes)).toContain('sidebar1');
    });

    it('should not hide if panel is only node', () => {
      store.getState().layout.setConfig({
        nodes: 'sidebar1',
        pinned: [],
        fixed: [],
      });

      store.getState().layout.togglePanel('sidebar1', false);

      expect(store.getState().layout.config.nodes).toBe('sidebar1');
    });

    it('should remove panel from pinned when hiding', () => {
      store.getState().layout.setConfig({
        nodes: {
          direction: 'row',
          first: 'sidebar1',
          second: MAIN_VIEW,
        },
        pinned: ['sidebar1'],
        fixed: [],
      });

      store.getState().layout.togglePanel('sidebar1', false);

      expect(store.getState().layout.config.pinned).not.toContain('sidebar1');
    });

    it('should not show if show is false', () => {
      store.getState().layout.setConfig({
        nodes: MAIN_VIEW,
        pinned: [],
        fixed: [],
      });

      store.getState().layout.togglePanel('sidebar1', false);

      expect(store.getState().layout.config.nodes).toBe(MAIN_VIEW);
    });
  });

  describe('togglePanelPin', () => {
    it('should pin an unpinned panel', () => {
      store.getState().layout.setConfig({
        nodes: {
          direction: 'row',
          first: 'sidebar1',
          second: MAIN_VIEW,
        },
        pinned: [],
        fixed: [],
      });

      store.getState().layout.togglePanelPin('sidebar1');

      expect(store.getState().layout.config.pinned).toContain('sidebar1');
    });

    it('should unpin a pinned panel', () => {
      store.getState().layout.setConfig({
        nodes: {
          direction: 'row',
          first: 'sidebar1',
          second: MAIN_VIEW,
        },
        pinned: ['sidebar1'],
        fixed: [],
      });

      store.getState().layout.togglePanelPin('sidebar1');

      expect(store.getState().layout.config.pinned).not.toContain('sidebar1');
    });

    it('should handle pinning multiple panels', () => {
      store.getState().layout.setConfig({
        nodes: {
          direction: 'row',
          first: 'sidebar1',
          second: {
            direction: 'row',
            first: 'sidebar2',
            second: MAIN_VIEW,
          },
        },
        pinned: [],
        fixed: [],
      });

      store.getState().layout.togglePanelPin('sidebar1');
      store.getState().layout.togglePanelPin('sidebar2');

      const pinned = store.getState().layout.config.pinned || [];
      expect(pinned).toContain('sidebar1');
      expect(pinned).toContain('sidebar2');
    });
  });

  describe('panel placement', () => {
    it('should respect sidebar placement', () => {
      const sidebarPanel: RoomPanelInfo = {
        title: 'Test Sidebar',
        component: () => null,
        placement: 'sidebar',
      };

      const testStore = createTestStore({testSidebar: sidebarPanel});

      expect(testStore.getState().layout.panels['testSidebar']?.placement).toBe(
        'sidebar',
      );
    });

    it('should respect sidebar-bottom placement', () => {
      const bottomPanel: RoomPanelInfo = {
        title: 'Test Bottom',
        component: () => null,
        placement: 'sidebar-bottom',
      };

      const testStore = createTestStore({testBottom: bottomPanel});

      expect(testStore.getState().layout.panels['testBottom']?.placement).toBe(
        'sidebar-bottom',
      );
    });

    it('should respect main placement', () => {
      const mainPanel: RoomPanelInfo = {
        title: 'Test Main',
        component: () => null,
        placement: 'main',
      };

      const testStore = createTestStore({testMain: mainPanel});

      expect(testStore.getState().layout.panels['testMain']?.placement).toBe(
        'main',
      );
    });
  });

  describe('panel metadata', () => {
    it('should store panel title', () => {
      expect(store.getState().layout.panels['sidebar1']?.title).toBe(
        'Sidebar 1',
      );
    });

    it('should store panel component', () => {
      expect(
        store.getState().layout.panels['sidebar1']?.component,
      ).toBeDefined();
    });

    it('should support panels without icons', () => {
      const panel: RoomPanelInfo = {
        title: 'No Icon',
        component: () => null,
        placement: 'sidebar',
      };

      const testStore = createTestStore({noIcon: panel});

      expect(testStore.getState().layout.panels['noIcon']?.icon).toBeUndefined();
    });

    it('should support panels with icons', () => {
      const IconComponent = () => null;
      const panel: RoomPanelInfo = {
        title: 'With Icon',
        icon: IconComponent,
        component: () => null,
        placement: 'sidebar',
      };

      const testStore = createTestStore({withIcon: panel});

      expect(testStore.getState().layout.panels['withIcon']?.icon).toBe(
        IconComponent,
      );
    });
  });

  describe('commands registration', () => {
    it('should register panel toggle commands on initialize', async () => {
      const testStore = createTestStore();
      await testStore.getState().layout.initialize?.();

      const commands = testStore.getState().commands?.registry;
      expect(commands).toBeDefined();
    });

    it('should unregister commands on destroy', async () => {
      const testStore = createTestStore();
      await testStore.getState().layout.initialize?.();

      const commandsBefore = Object.keys(
        testStore.getState().commands?.registry || {},
      ).length;

      await testStore.getState().layout.destroy?.();

      const commandsAfter = Object.keys(
        testStore.getState().commands?.registry || {},
      ).length;

      expect(commandsAfter).toBeLessThanOrEqual(commandsBefore);
    });
  });

  describe('complex layouts', () => {
    it('should handle nested layout structures', () => {
      const complexLayout = {
        nodes: {
          direction: 'row' as const,
          first: {
            direction: 'column' as const,
            first: 'sidebar1',
            second: 'sidebar2',
          },
          second: {
            direction: 'column' as const,
            first: MAIN_VIEW,
            second: 'sidebarBottom',
          },
        },
        pinned: [],
        fixed: [],
      };

      store.getState().layout.setConfig(complexLayout);

      expect(store.getState().layout.config.nodes).toEqual(complexLayout.nodes);
    });

    it('should handle fixed panels', () => {
      const config = {
        nodes: {
          direction: 'row' as const,
          first: 'sidebar1',
          second: MAIN_VIEW,
        },
        pinned: [],
        fixed: ['sidebar1'],
      };

      store.getState().layout.setConfig(config);

      expect(store.getState().layout.config.fixed).toContain('sidebar1');
    });

    it('should preserve both pinned and fixed arrays', () => {
      const config = {
        nodes: 'test-panel',
        pinned: ['panel1', 'panel2'],
        fixed: ['panel3'],
      };

      store.getState().layout.setConfig(config);

      expect(store.getState().layout.config.pinned).toEqual([
        'panel1',
        'panel2',
      ]);
      expect(store.getState().layout.config.fixed).toEqual(['panel3']);
    });
  });
});