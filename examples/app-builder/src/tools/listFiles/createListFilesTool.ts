import {TreeNodeData} from '@sqlrooms/ui';
import type {WebContainerSliceState} from '@sqlrooms/webcontainer';
import {tool} from 'ai';
import z from 'zod';
import {StoreApi} from 'zustand';
import {
  FileNodeObject,
  fileSystemTreeToNodes,
} from '../../components/filetree/fileSystemTreeToNodes';
import {ListFilesToolResult} from './ListFilesToolResult';

export const ListFilesToolParameters = z.object({
  basePath: z
    .string()
    .describe('Optional base path to list files from')
    .default('/'),
});
export type ListFilesToolParameters = z.infer<typeof ListFilesToolParameters>;
export type ListFilesToolOutput = {
  success: boolean;
  details: TreeNodeData<FileNodeObject>;
};

export function createListFilesTool(store: StoreApi<WebContainerSliceState>) {
  return tool({
    description: 'List project files',
    inputSchema: ListFilesToolParameters,
    execute: async ({basePath = '/'}) => {
      return {
        success: true,
        details: fileSystemTreeToNodes(
          store.getState().webContainer.config.filesTree,
          basePath,
        ),
      };
    },
  });
}

export const listFilesToolRenderer = ListFilesToolResult;
