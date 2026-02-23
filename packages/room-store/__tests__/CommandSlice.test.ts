import {createStore} from 'zustand';
import {
  createCommandSlice,
  createBaseRoomSlice,
  CommandSliceState,
  BaseRoomStoreState,
  RoomCommand,
  registerCommandsForOwner,
  unregisterCommandsForOwner,
} from '../src';

type TestStoreState = BaseRoomStoreState & CommandSliceState;

function createTestStore() {
  return createStore<TestStoreState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createCommandSlice()(...args),
  }));
}

describe('CommandSlice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe('registerCommand', () => {
    it('should register a single command', () => {
      const command: RoomCommand = {
        id: 'test.command',
        name: 'Test Command',
        execute: jest.fn(),
      };

      store.getState().commands.registerCommand('test-owner', command);

      expect(store.getState().commands.registry['test.command']).toBeDefined();
      expect(store.getState().commands.registry['test.command']?.owner).toBe(
        'test-owner',
      );
    });

    it('should register command with description', () => {
      const command: RoomCommand = {
        id: 'test.desc',
        name: 'Test',
        description: 'A test command',
        execute: jest.fn(),
      };

      store.getState().commands.registerCommand('owner', command);

      expect(store.getState().commands.registry['test.desc']?.description).toBe(
        'A test command',
      );
    });
  });

  describe('registerCommands', () => {
    it('should register multiple commands', () => {
      const commands: RoomCommand[] = [
        {id: 'cmd1', name: 'Command 1', execute: jest.fn()},
        {id: 'cmd2', name: 'Command 2', execute: jest.fn()},
        {id: 'cmd3', name: 'Command 3', execute: jest.fn()},
      ];

      store.getState().commands.registerCommands('multi-owner', commands);

      expect(store.getState().commands.registry['cmd1']).toBeDefined();
      expect(store.getState().commands.registry['cmd2']).toBeDefined();
      expect(store.getState().commands.registry['cmd3']).toBeDefined();
    });

    it('should track commands by owner', () => {
      const commands: RoomCommand[] = [
        {id: 'owner1.cmd1', name: 'Cmd 1', execute: jest.fn()},
        {id: 'owner1.cmd2', name: 'Cmd 2', execute: jest.fn()},
      ];

      store.getState().commands.registerCommands('owner1', commands);

      expect(store.getState().commands.ownerToCommandIds['owner1']).toEqual([
        'owner1.cmd1',
        'owner1.cmd2',
      ]);
    });

    it('should replace previous commands from same owner', () => {
      const commands1: RoomCommand[] = [
        {id: 'old1', name: 'Old 1', execute: jest.fn()},
        {id: 'old2', name: 'Old 2', execute: jest.fn()},
      ];

      const commands2: RoomCommand[] = [
        {id: 'new1', name: 'New 1', execute: jest.fn()},
      ];

      store.getState().commands.registerCommands('owner', commands1);
      store.getState().commands.registerCommands('owner', commands2);

      expect(store.getState().commands.registry['old1']).toBeUndefined();
      expect(store.getState().commands.registry['old2']).toBeUndefined();
      expect(store.getState().commands.registry['new1']).toBeDefined();
    });

    it('should handle commands from different owners', () => {
      const commands1: RoomCommand[] = [
        {id: 'a.cmd', name: 'A Command', execute: jest.fn()},
      ];
      const commands2: RoomCommand[] = [
        {id: 'b.cmd', name: 'B Command', execute: jest.fn()},
      ];

      store.getState().commands.registerCommands('ownerA', commands1);
      store.getState().commands.registerCommands('ownerB', commands2);

      expect(store.getState().commands.registry['a.cmd']?.owner).toBe('ownerA');
      expect(store.getState().commands.registry['b.cmd']?.owner).toBe('ownerB');
    });

    it('should reassign command when registered by different owner', () => {
      const command: RoomCommand = {
        id: 'shared.cmd',
        name: 'Shared Command',
        execute: jest.fn(),
      };

      store.getState().commands.registerCommand('owner1', command);
      expect(store.getState().commands.registry['shared.cmd']?.owner).toBe(
        'owner1',
      );

      store.getState().commands.registerCommand('owner2', command);
      expect(store.getState().commands.registry['shared.cmd']?.owner).toBe(
        'owner2',
      );
    });
  });

  describe('unregisterCommand', () => {
    it('should unregister a command', () => {
      const command: RoomCommand = {
        id: 'remove.me',
        name: 'Remove Me',
        execute: jest.fn(),
      };

      store.getState().commands.registerCommand('owner', command);
      expect(store.getState().commands.registry['remove.me']).toBeDefined();

      store.getState().commands.unregisterCommand('remove.me');
      expect(store.getState().commands.registry['remove.me']).toBeUndefined();
    });

    it('should handle unregistering non-existent command', () => {
      expect(() => {
        store.getState().commands.unregisterCommand('non.existent');
      }).not.toThrow();
    });
  });

  describe('unregisterCommands', () => {
    it('should unregister all commands from an owner', () => {
      const commands: RoomCommand[] = [
        {id: 'owner1.cmd1', name: 'Cmd 1', execute: jest.fn()},
        {id: 'owner1.cmd2', name: 'Cmd 2', execute: jest.fn()},
      ];

      store.getState().commands.registerCommands('owner1', commands);
      store.getState().commands.unregisterCommands('owner1');

      expect(store.getState().commands.registry['owner1.cmd1']).toBeUndefined();
      expect(store.getState().commands.registry['owner1.cmd2']).toBeUndefined();
      expect(
        store.getState().commands.ownerToCommandIds['owner1'],
      ).toBeUndefined();
    });

    it('should not affect commands from other owners', () => {
      const commands1: RoomCommand[] = [
        {id: 'owner1.cmd', name: 'Owner1 Cmd', execute: jest.fn()},
      ];
      const commands2: RoomCommand[] = [
        {id: 'owner2.cmd', name: 'Owner2 Cmd', execute: jest.fn()},
      ];

      store.getState().commands.registerCommands('owner1', commands1);
      store.getState().commands.registerCommands('owner2', commands2);

      store.getState().commands.unregisterCommands('owner1');

      expect(store.getState().commands.registry['owner1.cmd']).toBeUndefined();
      expect(store.getState().commands.registry['owner2.cmd']).toBeDefined();
    });
  });

  describe('executeCommand', () => {
    it('should execute a command', async () => {
      const executeFn = jest.fn();
      const command: RoomCommand = {
        id: 'exec.test',
        name: 'Execute Test',
        execute: executeFn,
      };

      store.getState().commands.registerCommand('owner', command);
      await store.getState().commands.executeCommand('exec.test');

      expect(executeFn).toHaveBeenCalled();
    });

    it('should provide execution context to command', async () => {
      let receivedContext: any;
      const command: RoomCommand = {
        id: 'context.test',
        name: 'Context Test',
        execute: (context) => {
          receivedContext = context;
        },
      };

      store.getState().commands.registerCommand('owner', command);
      await store.getState().commands.executeCommand('context.test');

      expect(receivedContext).toBeDefined();
      expect(receivedContext.store).toBe(store);
      expect(receivedContext.getState).toBeInstanceOf(Function);
    });

    it('should handle async commands', async () => {
      let executed = false;
      const command: RoomCommand = {
        id: 'async.test',
        name: 'Async Test',
        execute: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          executed = true;
        },
      };

      store.getState().commands.registerCommand('owner', command);
      await store.getState().commands.executeCommand('async.test');

      expect(executed).toBe(true);
    });

    it('should not error when executing non-existent command', async () => {
      await expect(
        store.getState().commands.executeCommand('non.existent'),
      ).resolves.toBeUndefined();
    });

    it('should capture exceptions during execution', async () => {
      const error = new Error('Command failed');
      const command: RoomCommand = {
        id: 'error.test',
        name: 'Error Test',
        execute: () => {
          throw error;
        },
      };

      store.getState().commands.registerCommand('owner', command);

      await expect(
        store.getState().commands.executeCommand('error.test'),
      ).rejects.toThrow('Command failed');
    });
  });

  describe('command metadata', () => {
    it('should store command with all metadata', () => {
      const command: RoomCommand = {
        id: 'full.cmd',
        name: 'Full Command',
        description: 'A complete command',
        group: 'Test Group',
        keywords: ['test', 'full', 'command'],
        shortcut: 'Ctrl+T',
        execute: jest.fn(),
        isVisible: () => true,
        isEnabled: () => true,
      };

      store.getState().commands.registerCommand('owner', command);

      const registered = store.getState().commands.registry['full.cmd'];
      expect(registered?.name).toBe('Full Command');
      expect(registered?.description).toBe('A complete command');
      expect(registered?.group).toBe('Test Group');
      expect(registered?.keywords).toEqual(['test', 'full', 'command']);
      expect(registered?.shortcut).toBe('Ctrl+T');
      expect(registered?.isVisible).toBeDefined();
      expect(registered?.isEnabled).toBeDefined();
    });
  });

  describe('registerCommandsForOwner helper', () => {
    it('should register commands using helper function', () => {
      const commands: RoomCommand[] = [
        {id: 'helper.cmd', name: 'Helper Command', execute: jest.fn()},
      ];

      registerCommandsForOwner(store, 'helper-owner', commands);

      expect(store.getState().commands.registry['helper.cmd']).toBeDefined();
    });
  });

  describe('unregisterCommandsForOwner helper', () => {
    it('should unregister commands using helper function', () => {
      const commands: RoomCommand[] = [
        {id: 'helper.cmd', name: 'Helper Command', execute: jest.fn()},
      ];

      registerCommandsForOwner(store, 'helper-owner', commands);
      expect(store.getState().commands.registry['helper.cmd']).toBeDefined();

      unregisterCommandsForOwner(store, 'helper-owner');
      expect(store.getState().commands.registry['helper.cmd']).toBeUndefined();
    });
  });

  describe('owner normalization', () => {
    it('should trim whitespace from owner names', () => {
      const command: RoomCommand = {
        id: 'trim.test',
        name: 'Trim Test',
        execute: jest.fn(),
      };

      store.getState().commands.registerCommand('  owner-with-spaces  ', command);

      expect(store.getState().commands.registry['trim.test']?.owner).toBe(
        'owner-with-spaces',
      );
    });

    it('should use default owner for empty string', () => {
      const command: RoomCommand = {
        id: 'empty.owner',
        name: 'Empty Owner',
        execute: jest.fn(),
      };

      store.getState().commands.registerCommand('', command);

      expect(store.getState().commands.registry['empty.owner']?.owner).toBe(
        'global',
      );
    });
  });
});