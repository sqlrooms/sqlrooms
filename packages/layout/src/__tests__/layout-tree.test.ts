import {
  findNodeById,
  visitLayoutLeafNodes,
  removeLayoutNodeByKey,
  getVisibleLayoutPanels,
  findNearestDockAncestor,
  isDockablePanel,
} from '../layout-tree';
import type {LayoutNode, LayoutDockNode} from '@sqlrooms/layout-config';

describe('layout-tree', () => {
  describe('findNodeById with dock nodes', () => {
    it('should find dock node itself by id', () => {
      const dockNode: LayoutDockNode = {
        type: 'dock',
        id: 'dock-1',
        root: {
          type: 'panel',
          id: 'panel-1',
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
        root: {
          type: 'split',
          id: 'split-1',
          direction: 'row',
          children: [
            {type: 'panel', id: 'panel-1'},
            {type: 'panel', id: 'panel-2'},
          ],
        },
      };

      const result = findNodeById(dockNode, 'panel-2');
      expect(result).toBeDefined();
      expect(result?.node).toEqual({type: 'panel', id: 'panel-2'});
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
          {type: 'panel', id: 'left-panel'},
          {
            type: 'dock',
            id: 'dock-1',
            root: {
              type: 'panel',
              id: 'docked-panel',
            },
          },
        ],
      };

      const result = findNodeById(layout, 'docked-panel');
      expect(result).toBeDefined();
      expect(result?.node).toEqual({type: 'panel', id: 'docked-panel'});
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
        root: {
          type: 'tabs',
          id: 'tabs-1',
          activeTabIndex: 0,
          children: [
            {type: 'panel', id: 'panel-1'},
            {type: 'panel', id: 'panel-2'},
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
          {type: 'panel', id: 'regular-panel'},
          {
            type: 'dock',
            id: 'dock-1',
            root: {
              type: 'panel',
              id: 'docked-panel-1',
            },
          },
          {
            type: 'dock',
            id: 'dock-2',
            root: {
              type: 'panel',
              id: 'docked-panel-2',
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

  describe('removeLayoutNodeByKey with dock nodes', () => {
    it('should remove panel inside dock.root', () => {
      const dockNode: LayoutDockNode = {
        type: 'dock',
        id: 'dock-1',
        root: {
          type: 'split',
          id: 'split-1',
          direction: 'row',
          children: [
            {type: 'panel', id: 'panel-1'},
            {type: 'panel', id: 'panel-2'},
          ],
        },
      };

      const result = removeLayoutNodeByKey(dockNode, 'panel-1');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.nextTree).toMatchObject({
          type: 'dock',
          id: 'dock-1',
          root: {
            type: 'panel',
            id: 'panel-2',
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
          {type: 'panel', id: 'panel-1'},
          {
            type: 'dock',
            id: 'dock-1',
            root: {
              type: 'panel',
              id: 'panel-2',
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
          {type: 'panel', id: 'panel-1'},
          {
            type: 'dock',
            id: 'dock-1',
            root: {
              type: 'tabs',
              id: 'tabs-1',
              activeTabIndex: 0,
              children: [
                {type: 'panel', id: 'docked-panel-1'},
                {type: 'panel', id: 'docked-panel-2'},
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
        root: {type: 'panel', id: 'panel-1'},
      };

      const result = findNearestDockAncestor(layout, 'non-existent');
      expect(result).toBeUndefined();
    });

    it('should return dock ancestor for panel inside dock', () => {
      const layout: LayoutNode = {
        type: 'dock',
        id: 'dock-1',
        root: {type: 'panel', id: 'panel-1'},
      };

      const result = findNearestDockAncestor(layout, 'panel-1');
      expect(result).toEqual({
        type: 'dock',
        id: 'dock-1',
        root: {type: 'panel', id: 'panel-1'},
      });
    });

    it('should return dock ancestor for deeply nested panel', () => {
      const layout: LayoutNode = {
        type: 'dock',
        id: 'dock-1',
        root: {
          type: 'split',
          id: 'split-1',
          direction: 'row',
          children: [
            {
              type: 'tabs',
              id: 'tabs-1',
              activeTabIndex: 0,
              children: [{type: 'panel', id: 'panel-1'}],
            },
          ],
        },
      };

      const result = findNearestDockAncestor(layout, 'panel-1');
      expect(result).toEqual({
        type: 'dock',
        id: 'dock-1',
        root: layout.root,
      });
    });

    it('should return undefined for panel outside dock', () => {
      const layout: LayoutNode = {
        type: 'split',
        id: 'root-split',
        direction: 'row',
        children: [
          {type: 'panel', id: 'panel-1'},
          {
            type: 'dock',
            id: 'dock-1',
            root: {type: 'panel', id: 'panel-2'},
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
        root: {type: 'panel', id: 'panel-1'},
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
        root: {type: 'panel', id: 'panel-1'},
      };

      expect(isDockablePanel(layout, 'panel-1')).toBe(true);
    });

    it('should return false for panel outside dock', () => {
      const layout: LayoutNode = {
        type: 'split',
        id: 'root-split',
        direction: 'row',
        children: [
          {type: 'panel', id: 'panel-1'},
          {
            type: 'dock',
            id: 'dock-1',
            root: {type: 'panel', id: 'panel-2'},
          },
        ],
      };

      expect(isDockablePanel(layout, 'panel-1')).toBe(false);
    });

    it('should return false for non-existent panel', () => {
      const layout: LayoutNode = {
        type: 'dock',
        id: 'dock-1',
        root: {type: 'panel', id: 'panel-1'},
      };

      expect(isDockablePanel(layout, 'non-existent')).toBe(false);
    });
  });
});
