import {z} from 'zod';

export const ArtifactType = z.enum(['notebook', 'canvas', 'app']);
export type ArtifactType = z.infer<typeof ArtifactType>;

export const ProjectArtifact = z.object({
  artifactId: z.string(),
  type: ArtifactType,
  name: z.string(),
  metadata: z.record(z.string(), z.any()).default({}),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type ProjectArtifact = z.infer<typeof ProjectArtifact>;

export const ProjectInfo = z.object({
  mode: z.enum(['artifact']),
  dbPath: z.string().optional(),
  metaNamespace: z.string().default('__sqlrooms'),
});
export type ProjectInfo = z.infer<typeof ProjectInfo>;

export type ArtifactFile = {
  path: string;
  content: string;
};

// Keep adapters explicit so source-directory mode can slot in later.
export type ProjectStorageAdapter = {
  mode: 'artifact' | 'source';
  listArtifacts: () => Promise<ProjectArtifact[]>;
  createArtifact: (args: {
    type: ArtifactType;
    name: string;
    metadata?: Record<string, unknown>;
  }) => Promise<ProjectArtifact>;
};

export type AppRuntimeAdapter = {
  runCommand?: (
    command: string,
    args?: string[],
  ) => Promise<{exitCode: number; stdout: string; stderr: string}>;
  probeCapabilities?: (commands: string[]) => Promise<Record<string, boolean>>;
};
