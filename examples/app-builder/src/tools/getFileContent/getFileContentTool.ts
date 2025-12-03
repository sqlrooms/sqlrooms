import {StoreApi} from 'zustand';
import {WebContainerSliceState} from '../../store/WebContainerSlice';
import z from 'zod';
import {AiSliceTool} from '@sqlrooms/ai-core';
import {GetFileContentToolResult} from './GetFileContentToolResult';

export function createGetFileContentTool(
  store: StoreApi<WebContainerSliceState>,
): AiSliceTool {
  return {
    description: 'Get the content of a file',
    parameters: z.object({
      path: z.string().describe('The path to the file'),
    }),
    execute: async ({path}: {path: string}) => {
      const content = await store.getState().webContainer.getFileContent(path);
      return {
        llmResult: {
          success: true,
          details: {
            path,
            content,
          },
        },
      };
    },
    component: GetFileContentToolResult,
  };
}
