// import {tool} from 'ai';
// import {z} from 'zod';
// import type {DashboardAiAdapter} from './types';

// const DashboardCreateArtifactToolParameters = z.object({
//   title: z.string().optional(),
//   layoutType: z
//     .enum(['dock', 'grid'])
//     .optional()
//     .default('grid')
//     .describe('Dashboard layout node type to use at creation time.'),
// });
// type DashboardCreateArtifactToolParameters = z.infer<
//   typeof DashboardCreateArtifactToolParameters
// >;

// export function createDashboardArtifactTool(adapter: DashboardAiAdapter) {
//   return tool({
//     description:
//       'Create a new dashboard artifact with a dock or grid layout and make it the active artifact. Use when no dashboard artifact exists yet.',
//     inputSchema: DashboardCreateArtifactToolParameters,
//     execute: async (params: DashboardCreateArtifactToolParameters, context) => {
//       const artifactId = adapter.createDashboardArtifact(
//         params.title,
//         params.layoutType,
//       );
//       adapter.setCurrentArtifact(artifactId);
//       adapter.makeDashboardPrimaryForRun?.(artifactId, context);
//       return {
//         llmResult: {
//           success: true,
//           details: `Created dashboard artifact "${artifactId}".`,
//           data: {artifactId},
//         },
//       };
//     },
//   });
// }
