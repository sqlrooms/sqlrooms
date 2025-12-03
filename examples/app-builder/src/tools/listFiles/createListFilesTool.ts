import z from 'zod';
import {StoreApi} from 'zustand';
import {
  FileNodeObject,
  fileSystemTreeToNodes,
} from '../../components/filetree/fileSystemTreeToNodes';
import {WebContainerSliceState} from '../../store/WebContainerSlice';
import {ListFilesToolResult} from './ListFilesToolResult';
import type {OpenAssistantTool} from '@openassistant/utils';
import {TreeNodeData} from '@sqlrooms/ui';

export const ListFilesToolParameters = z.object({
  basePath: z
    .string()
    .describe('Optional base path to list files from')
    .default('/'),
});
export type ListFilesToolParameters = z.infer<typeof ListFilesToolParameters>;
export type ListFilesToolLlmResult = {
  success: boolean;
  details: TreeNodeData<FileNodeObject>;
};
export type ListFilesToolAdditionalData = Record<string, never>;
export type ListFilesToolContext = unknown;

export function createListFilesTool(
  store: StoreApi<WebContainerSliceState>,
): OpenAssistantTool<
  typeof ListFilesToolParameters,
  ListFilesToolLlmResult,
  ListFilesToolAdditionalData,
  ListFilesToolContext
> {
  return {
    name: 'listFiles',
    description: 'List project files',
    parameters: z.object({
      basePath: z
        .string()
        .describe('Optional base path to list files from')
        .default('/'),
    }),
    execute: async ({basePath = '/'}: ListFilesToolParameters) => {
      return {
        llmResult: {
          success: true,
          details: fileSystemTreeToNodes(
            store.getState().webContainer.config.filesTree,
            basePath,
          ),
        },
      };
    },
    component: ListFilesToolResult,
  };
}
