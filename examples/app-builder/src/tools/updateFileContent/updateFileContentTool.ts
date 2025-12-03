import {AiSliceTool} from '@sqlrooms/ai-core';
import z from 'zod';
import {StoreApi} from 'zustand';
import {WebContainerSliceState} from '../../store/WebContainerSlice';
import {UpdateFileContentToolResult} from './UpdateFileContentToolResult';

export function createUpdateFileContentTool(
  store: StoreApi<WebContainerSliceState>,
): AiSliceTool {
  return {
    description: 'Modify the content of a file',
    parameters: z.object({
      path: z.string().describe('The path to the file'),
      content: z.string().describe('The content to set'),
    }),
    execute: async ({path, content}: {path: string; content: string}) => {
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
