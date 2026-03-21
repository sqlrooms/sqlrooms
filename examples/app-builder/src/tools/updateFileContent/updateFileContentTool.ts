import type {WebContainerSliceState} from '@sqlrooms/webcontainer';
import {tool} from 'ai';
import z from 'zod';
import {StoreApi} from 'zustand';
import {UpdateFileContentToolResult} from './UpdateFileContentToolResult';

export const UpdateFileContentToolParameters = z.object({
  path: z.string().describe('The path to the file'),
  content: z.string().describe('The content to set'),
});
export type UpdateFileContentToolParameters = z.infer<
  typeof UpdateFileContentToolParameters
>;
export type UpdateFileContentToolOutput = {
  success: boolean;
  details: {
    path: string;
  };
};

export function createUpdateFileContentTool(
  store: StoreApi<WebContainerSliceState>,
) {
  return tool({
    description: 'Modify the content of a file',
    inputSchema: UpdateFileContentToolParameters,
    execute: async ({path, content}) => {
      store.getState().webContainer.updateFileContent(path, content);
      await store.getState().webContainer.saveAllOpenFiles();
      return {
        success: true,
        details: {path},
      };
    },
  });
}

export const updateFileContentToolRenderer = UpdateFileContentToolResult;
