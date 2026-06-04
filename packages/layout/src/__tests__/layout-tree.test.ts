import {
  findNodeById,
  visitLayoutLeafNodes,
  removeLayoutNodeByKey,
  getVisibleLayoutPanels,
  findNearestDockAncestor,
  isDockablePanel,
  updateLayoutNodeById,
} from '../layout-tree';
import type {
  LayoutNode,
  LayoutDockNode,
  LayoutGridNode,
} from '@sqlrooms/layout-config';

describe('layout-tree', () => {
  describe('findNodeById with dock nodes', () => {
    it('should find dock node itself by id', () => {
      const dockNode: LayoutDockNode = {
        type: 'dock',
        id: 'dock-1',
        panel: 'dock-1',
        root: {
          type: 'panel',
          id: 'panel-1',
          panel: 'panel-1',
        },
      };

      const result = findNodeById(dockNode, 'dock-1');
      expect(result).toBeDefined();
      expect(result?.node).toBe(dockNode);
      expect(result?.ancestors).toEqual([]);
    });

    it('should find nodes inside dock.root', () => {
      const dockNode: LayoutDockNode = {
        type: 'dock',
        id: 'dock-1',
        panel: 'dock-1',
        root: {
          type: 'split',
          id: 'split-1',
          direction: 'row',
          children: [
            {type: 'panel', id: 'panel-1', panel: 'panel-1'},
            {type: 'panel', id: 'panel-2', panel: 'panel-2'},
          ],
        },
      };

      const result = findNodeById(dockNode, 'panel-2');
      expect(result).toBeDefined();
      expect(result?.node).toEqual({
        type: 'panel',
        id: 'panel-2',
        panel: 'panel-2',
      });
      expect(
        result?.ancestors.map((n) => (typeof n === 'string' ? n : n.id)),
      ).toEqual(['dock-1', 'split-1']);
    });

    it('should handle nested dock nodes', () => {
      const layout: LayoutNode = {
        type: 'split',
        id: 'root-split',
        direction: 'row',
        children: [
          {type: 'panel', id: 'left-panel', panel: 'left-panel'},
          {
            type: 'dock',
            id: 'dock-1',
            panel: 'dock-1',
            root: {
              type: 'panel',
              id: 'docked-panel',
              panel: 'docked-panel',
            },
          },
        ],
      };

      const result = findNodeById(layout, 'docked-panel');
      expect(result).toBeDefined();
      expect(result?.node).toEqual({
        type: 'panel',
        id: 'docked-panel',
        panel: 'docked-panel',
      });
      expect(
        result?.ancestors.map((n) => (typeof n === 'string' ? n : n.id)),
      ).toEqual(['root-split', 'dock-1']);
    });
  });

  describe('visitLayoutLeafNodes with dock nodes', () => {
    it('should visit panels inside dock.root', () => {
      const dockNode: LayoutDockNode = {
        type: 'dock',
        id: 'dock-1',
        panel: 'dock-1',
        root: {
          type: 'tabs',
          id: 'tabs-1',
          activeTabIndex: 0,
          children: [
            {type: 'panel', id: 'panel-1', panel: 'panel-1'},
            {type: 'panel', id: 'panel-2', panel: 'panel-2'},
          ],
        },
      };

      const visited: string[] = [];
      visitLayoutLeafNodes(dockNode, (nodeId) => {
        visited.push(nodeId);
      });

      // visitLayoutLeafNodes visits all non-hidden tabs, not just the active one
      expect(visited).toEqual(['panel-1', 'panel-2']);
    });

    it('should visit panels across multiple dock nodes', () => {
      const layout: LayoutNode = {
        type: 'split',
        id: 'root-split',
        direction: 'row',
        children: [
          {type: 'panel', id: 'regular-panel', panel: 'regular-panel'},
          {
            type: 'dock',
            id: 'dock-1',
            panel: 'dock-1',
            root: {
              type: 'panel',
              id: 'docked-panel-1',
              panel: 'docked-panel-1',
            },
          },
          {
            type: 'dock',
            id: 'dock-2',
            panel: 'dock-2',
            root: {
              type: 'panel',
              id: 'docked-panel-2',
              panel: 'docked-panel-2',
            },
          },
        ],
      };

      const visited: string[] = [];
      visitLayoutLeafNodes(layout, (nodeId) => {
        visited.push(nodeId);
      });

      expect(visited).toEqual([
        'regular-panel',
        'docked-panel-1',
        'docked-panel-2',
      ]);
    });
  });

  describe('grid nodes', () => {
    const gridNode: LayoutGridNode = {
      type: 'grid',
      id: 'grid-1',
      panel: {key: 'dashboard', meta: {dashboardId: 'growth'}},
      children: [
        {type: 'panel', id: 'panel-1', panel: 'panel-1'},
        {type: 'panel', id: 'panel-2', panel: 'panel-2'},
      ],
    };

    it('should find nodes inside grid.children', () => {
      const result = findNodeById(gridNode, 'panel-2');

      expect(result).toBeDefined();
      expect(result?.node).toEqual({
        type: 'panel',
        id: 'panel-2',
        panel: 'panel-2',
      });
      expect(
        result?.ancestors.map((n) => (typeof n === 'string' ? n : n.id)),
      ).toEqual(['grid-1']);
    });

    it('should visit panels inside grid.children', () => {
      const visited: string[] = [];
      visitLayoutLeafNodes(gridNode, (nodeId) => {
        visited.push(nodeId);
      });

      expect(visited).toEqual(['panel-1', 'panel-2']);
    });

    it('should remove panels inside grid.children', () => {
      const result = removeLayoutNodeByKey(gridNode, 'panel-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.nextTree).toMatchObject({
          type: 'grid',
          id: 'grid-1',
          children: [{type: 'panel', id: 'panel-2', panel: 'panel-2'}],
        });
      }
    });
  });

  describe('removeLayoutNodeByKey with dock nodes', () => {
    it('should remove panel inside dock.root', () => {
      const dockNode: LayoutDockNode = {
        type: 'dock',
        id: 'dock-1',
        panel: 'dock-1',
        root: {
          type: 'split',
          id: 'split-1',
          direction: 'row',
          children: [
            {type: 'panel', id: 'panel-1', panel: 'panel-1'},
            {type: 'panel', id: 'panel-2', panel: 'panel-2'},
          ],
        },
      };

      const result = removeLayoutNodeByKey(dockNode, 'panel-1');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.nextTree).toMatchObject({
          type: 'dock',
          id: 'dock-1',
          panel: 'dock-1',
          root: {
            type: 'panel',
            id: 'panel-2',
            panel: 'panel-2',
          },
        });
      }
    });

    it('should remove entire dock node', () => {
      const layout: LayoutNode = {
        type: 'split',
        id: 'root-split',
        direction: 'row',
        children: [
          {type: 'panel', id: 'panel-1', panel: 'panel-1'},
          {
            type: 'dock',
            id: 'dock-1',
            panel: 'dock-1',
            root: {
              type: 'panel',
              id: 'panel-2',
              panel: 'panel-2',
            },
          },
        ],
      };

      const result = removeLayoutNodeByKey(layout, 'dock-1');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.nextTree).toMatchObject({
          type: 'panel',
          id: 'panel-1',
          panel: 'panel-1',
        });
      }
    });
  });

  describe('getVisibleLayoutPanels with dock nodes', () => {
    it('should include panels from dock nodes', () => {
      const layout: LayoutNode = {
        type: 'split',
        id: 'root-split',
        direction: 'row',
        children: [
          {type: 'panel', id: 'panel-1', panel: 'panel-1'},
          {
            type: 'dock',
            id: 'dock-1',
            panel: 'dock-1',
            root: {
              type: 'tabs',
              id: 'tabs-1',
              activeTabIndex: 0,
              children: [
                {type: 'panel', id: 'docked-panel-1', panel: 'docked-panel-1'},
                {type: 'panel', id: 'docked-panel-2', panel: 'docked-panel-2'},
              ],
            },
          },
        ],
      };

      const panels = getVisibleLayoutPanels(layout);
      // getVisibleLayoutPanels includes all non-hidden tabs, not just the active one
      expect(panels).toEqual(['panel-1', 'docked-panel-1', 'docked-panel-2']);
    });
  });

  describe('findNearestDockAncestor', () => {
    it('should return undefined for non-existent node', () => {
      const layout: LayoutNode = {
        type: 'dock',
        id: 'dock-1',
        panel: 'dock-1',
        root: {type: 'panel', id: 'panel-1', panel: 'panel-1'},
      };

      const result = findNearestDockAncestor(layout, 'non-existent');
      expect(result).toBeUndefined();
    });

    it('should return dock ancestor for panel inside dock', () => {
      const layout: LayoutNode = {
        type: 'dock',
        id: 'dock-1',
        panel: 'dock-1',
        root: {type: 'panel', id: 'panel-1', panel: 'panel-1'},
      };

      const result = findNearestDockAncestor(layout, 'panel-1');
      expect(result).toEqual({
        type: 'dock',
        id: 'dock-1',
        panel: 'dock-1',
        root: {type: 'panel', id: 'panel-1', panel: 'panel-1'},
      });
    });

    it('should return dock ancestor for deeply nested panel', () => {
      const layout: LayoutNode = {
        type: 'dock',
        id: 'dock-1',
        panel: 'dock-1',
        root: {
          type: 'split',
          id: 'split-1',
          direction: 'row',
          children: [
            {
              type: 'tabs',
              id: 'tabs-1',
              activeTabIndex: 0,
              children: [{type: 'panel', id: 'panel-1', panel: 'panel-1'}],
            },
          ],
        },
      };

      const result = findNearestDockAncestor(layout, 'panel-1');
      expect(result).toEqual({
        type: 'dock',
        id: 'dock-1',
        panel: 'dock-1',
        root: layout.root,
      });
    });

    it('should return undefined for panel outside dock', () => {
      const layout: LayoutNode = {
        type: 'split',
        id: 'root-split',
        direction: 'row',
        children: [
          {type: 'panel', id: 'panel-1', panel: 'panel-1'},
          {
            type: 'dock',
            id: 'dock-1',
            panel: 'dock-1',
            root: {type: 'panel', id: 'panel-2', panel: 'panel-2'},
          },
        ],
      };

      const result = findNearestDockAncestor(layout, 'panel-1');
      expect(result).toBeUndefined();
    });

    it('should return undefined for dock node itself', () => {
      const layout: LayoutNode = {
        type: 'dock',
        id: 'dock-1',
        panel: 'dock-1',
        root: {type: 'panel', id: 'panel-1', panel: 'panel-1'},
      };

      const result = findNearestDockAncestor(layout, 'dock-1');
      expect(result).toBeUndefined();
    });
  });

  describe('isDockablePanel', () => {
    it('should return true for panel inside dock', () => {
      const layout: LayoutNode = {
        type: 'dock',
        id: 'dock-1',
        panel: 'dock-1',
        root: {type: 'panel', id: 'panel-1', panel: 'panel-1'},
      };

      expect(isDockablePanel(layout, 'panel-1')).toBe(true);
    });

    it('should return false for panel outside dock', () => {
      const layout: LayoutNode = {
        type: 'split',
        id: 'root-split',
        direction: 'row',
        children: [
          {type: 'panel', id: 'panel-1', panel: 'panel-1'},
          {
            type: 'dock',
            id: 'dock-1',
            panel: 'dock-1',
            root: {type: 'panel', id: 'panel-2', panel: 'panel-2'},
          },
        ],
      };

      expect(isDockablePanel(layout, 'panel-1')).toBe(false);
    });

    it('should return false for non-existent panel', () => {
      const layout: LayoutNode = {
        type: 'dock',
        id: 'dock-1',
        panel: 'dock-1',
        root: {type: 'panel', id: 'panel-1', panel: 'panel-1'},
      };

      expect(isDockablePanel(layout, 'non-existent')).toBe(false);
    });
  });

  describe('updateLayoutNodeById', () => {
    it('updates a nested layout node without changing siblings', () => {
      const layout: LayoutNode = {
        type: 'split',
        id: 'root-split',
        direction: 'row',
        children: [
          {type: 'panel', id: 'left', panel: 'left', defaultSize: '30%'},
          {type: 'panel', id: 'right', panel: 'right', defaultSize: '70%'},
        ],
      };

      const nextLayout = updateLayoutNodeById(layout, 'right', (node) =>
        typeof node === 'string' ? node : {...node, defaultSize: '420px'},
      );

      expect(nextLayout).toEqual({
        type: 'split',
        id: 'root-split',
        direction: 'row',
        children: [
          {type: 'panel', id: 'left', panel: 'left', defaultSize: '30%'},
          {type: 'panel', id: 'right', panel: 'right', defaultSize: '420px'},
        ],
      });
      expect(nextLayout).not.toBe(layout);
    });

    it('can replace a string panel key with a panel node', () => {
      const layout: LayoutNode = {
        type: 'split',
        id: 'root-split',
        direction: 'row',
        children: ['left', 'right'],
      };

      const nextLayout = updateLayoutNodeById(layout, 'right', (node) =>
        typeof node === 'string'
          ? {type: 'panel', id: node, panel: node, defaultSize: '40%'}
          : node,
      );

      expect(nextLayout).toEqual({
        type: 'split',
        id: 'root-split',
        direction: 'row',
        children: [
          'left',
          {type: 'panel', id: 'right', panel: 'right', defaultSize: '40%'},
        ],
      });
    });

    it('updates a node inside dock.root', () => {
      const layout: LayoutNode = {
        type: 'dock',
        id: 'dock-1',
        panel: 'dock-1',
        root: {
          type: 'split',
          id: 'split-1',
          direction: 'row',
          children: [
            {
              type: 'panel',
              id: 'panel-1',
              panel: 'panel-1',
              defaultSize: '50%',
            },
            {
              type: 'panel',
              id: 'panel-2',
              panel: 'panel-2',
              defaultSize: '50%',
            },
          ],
        },
      };

      const nextLayout = updateLayoutNodeById(layout, 'panel-1', (node) =>
        typeof node === 'string' ? node : {...node, defaultSize: '30%'},
      );

      expect(nextLayout).not.toBe(layout);
      expect(nextLayout).toMatchObject({
        type: 'dock',
        id: 'dock-1',
        root: {
          type: 'split',
          children: [
            {id: 'panel-1', defaultSize: '30%'},
            {id: 'panel-2', defaultSize: '50%'},
          ],
        },
      });
    });

    it('updates a node inside a tabs subtree', () => {
      const layout: LayoutNode = {
        type: 'tabs',
        id: 'tabs-1',
        activeTabIndex: 0,
        children: [
          {type: 'panel', id: 'tab-a', panel: 'tab-a'},
          {type: 'panel', id: 'tab-b', panel: 'tab-b'},
        ],
      };

      const nextLayout = updateLayoutNodeById(layout, 'tab-b', (node) =>
        typeof node === 'string' ? node : {...node, defaultSize: '60%'},
      );

      expect(nextLayout).not.toBe(layout);
      expect(nextLayout).toMatchObject({
        type: 'tabs',
        children: [{id: 'tab-a'}, {id: 'tab-b', defaultSize: '60%'}],
      });
    });

    it('updates a node inside a grid subtree', () => {
      const layout: LayoutGridNode = {
        type: 'grid',
        id: 'grid-1',
        panel: {key: 'dashboard', meta: {}},
        children: [
          {type: 'panel', id: 'cell-1', panel: 'cell-1'},
          {type: 'panel', id: 'cell-2', panel: 'cell-2'},
        ],
      };

      const nextLayout = updateLayoutNodeById(layout, 'cell-2', (node) =>
        typeof node === 'string' ? node : {...node, defaultSize: '200px'},
      );

      expect(nextLayout).not.toBe(layout);
      expect(nextLayout).toMatchObject({
        type: 'grid',
        children: [{id: 'cell-1'}, {id: 'cell-2', defaultSize: '200px'}],
      });
    });

    it('preserves referential equality when target is not found', () => {
      const layout: LayoutNode = {
        type: 'dock',
        id: 'dock-1',
        panel: 'dock-1',
        root: {type: 'panel', id: 'panel-1', panel: 'panel-1'},
      };

      const nextLayout = updateLayoutNodeById(layout, 'non-existent', (node) =>
        typeof node === 'string' ? node : {...node, defaultSize: '100%'},
      );

      expect(nextLayout).toBe(layout);
    });

    it('preserves referential equality when updater returns same reference', () => {
      const layout: LayoutNode = {
        type: 'split',
        id: 'root-split',
        direction: 'row',
        children: [
          {type: 'panel', id: 'left', panel: 'left', defaultSize: '30%'},
          {type: 'panel', id: 'right', panel: 'right', defaultSize: '70%'},
        ],
      };

      const nextLayout = updateLayoutNodeById(layout, 'right', (node) => node);

      expect(nextLayout).toBe(layout);
    });
  });
});
