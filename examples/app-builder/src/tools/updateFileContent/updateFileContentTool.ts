import type {OpenAssistantTool} from '@openassistant/utils';
import z from 'zod';
import {StoreApi} from 'zustand';
import type {WebContainerSliceState} from '../../../../../packages/webcontainer/dist';
import {UpdateFileContentToolResult} from './UpdateFileContentToolResult';

export const UpdateFileContentToolParameters = z.object({
  path: z.string().describe('The path to the file'),
  content: z.string().describe('The content to set'),
});
export type UpdateFileContentToolParameters = z.infer<
  typeof UpdateFileContentToolParameters
>;
export type UpdateFileContentToolLlmResult = {
  success: boolean;
  details: {
    path: string;
  };
};
export type UpdateFileContentToolAdditionalData = Record<string, never>;
export type UpdateFileContentToolContext = unknown;

export function createUpdateFileContentTool(
  store: StoreApi<WebContainerSliceState>,
): OpenAssistantTool<
  typeof UpdateFileContentToolParameters,
  UpdateFileContentToolLlmResult,
  UpdateFileContentToolAdditionalData,
  UpdateFileContentToolContext
> {
  return {
    name: 'updateFileContent',
    description: 'Modify the content of a file',
    parameters: UpdateFileContentToolParameters,
    execute: async ({path, content}: UpdateFileContentToolParameters) => {
      await store.getState().webcontainer.updateFileContent(path, content);
      await store.getState().webcontainer.saveAllOpenFiles();
      return {
        llmResult: {
          success: true,
          details: {path},
        },
      };
    },
    component: UpdateFileContentToolResult,
  };
}
