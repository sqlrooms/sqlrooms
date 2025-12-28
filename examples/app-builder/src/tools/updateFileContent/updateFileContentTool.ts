import z from 'zod';
import {StoreApi} from 'zustand';
import {WebContainerSliceState} from '../../store/WebContainerSlice';
import {UpdateFileContentToolResult} from './UpdateFileContentToolResult';
import type {OpenAssistantTool} from '@openassistant/utils';

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
      await store.getState().webContainer.updateFileContent(path, content);
      await store.getState().webContainer.saveAllOpenFiles();
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
