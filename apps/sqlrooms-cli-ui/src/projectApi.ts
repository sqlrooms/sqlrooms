import {
  ArtifactFile,
  ArtifactType,
  ProjectArtifact,
  ProjectInfo,
} from './projectModel';
import {RuntimeConfig} from './runtimeConfig';

function getApiBaseUrl(config: RuntimeConfig): string {
  return (config.apiBaseUrl || '').replace(/\/$/, '');
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function getProjectInfo(
  config: RuntimeConfig,
): Promise<ProjectInfo> {
  const data = await fetchJson<unknown>(
    `${getApiBaseUrl(config)}/api/project/info`,
  );
  return ProjectInfo.parse(data);
}

export async function listArtifacts(
  config: RuntimeConfig,
): Promise<ProjectArtifact[]> {
  const data = await fetchJson<unknown>(
    `${getApiBaseUrl(config)}/api/artifacts`,
  );
  return zArray(ProjectArtifact).parse(data);
}

export async function createArtifact(
  config: RuntimeConfig,
  args: {
    type: ArtifactType;
    name: string;
    metadata?: Record<string, unknown>;
  },
): Promise<ProjectArtifact> {
  const data = await fetchJson<unknown>(
    `${getApiBaseUrl(config)}/api/artifacts`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(args),
    },
  );
  return ProjectArtifact.parse(data);
}

export async function writeArtifactFiles(
  config: RuntimeConfig,
  artifactId: string,
  files: ArtifactFile[],
): Promise<void> {
  await fetchJson(
    `${getApiBaseUrl(config)}/api/artifacts/${artifactId}/files`,
    {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({files}),
    },
  );
}

export async function readArtifactFiles(
  config: RuntimeConfig,
  artifactId: string,
): Promise<ArtifactFile[]> {
  const data = await fetchJson<unknown>(
    `${getApiBaseUrl(config)}/api/artifacts/${artifactId}/files`,
  );
  if (!Array.isArray(data)) return [];
  return data
    .map((x) => ({
      path: String((x as any)?.path || ''),
      content: String((x as any)?.content || ''),
    }))
    .filter((x) => Boolean(x.path));
}

export async function generateAppFromPrompt(
  config: RuntimeConfig,
  artifactId: string,
  input: {prompt: string; template: string},
): Promise<{status: string; attempts: number; errors: string[]}> {
  return await fetchJson(
    `${getApiBaseUrl(config)}/api/apps/${artifactId}/generate`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(input),
    },
  );
}

function zArray<T>(schema: {parse: (value: unknown) => T}) {
  return {
    parse(value: unknown) {
      if (!Array.isArray(value)) return [];
      return value.map((v) => schema.parse(v));
    },
  };
}
