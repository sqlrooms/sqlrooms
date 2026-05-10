import type {ArtifactsSliceConfigType} from '@sqlrooms/artifacts';
import YAML from 'yaml';
import type {DocumentsSliceConfig} from './DocumentsSliceConfig';

export type DocumentLink = {
  sourceArtifactId: string;
  sourceTitle: string;
  targetArtifactId: string;
  targetTitle: string;
};

export type UnresolvedDocumentLink = {
  sourceArtifactId: string;
  sourceTitle: string;
  targetTitle: string;
  reason: 'missing' | 'ambiguous';
};

export type DocumentTag = {
  artifactId: string;
  title: string;
  tag: string;
};

export type KnowledgeIndex = {
  linksByArtifactId: Record<string, DocumentLink[]>;
  backlinksByArtifactId: Record<string, DocumentLink[]>;
  tagsByArtifactId: Record<string, DocumentTag[]>;
  unresolvedLinks: UnresolvedDocumentLink[];
};

export type BuildKnowledgeIndexProps = {
  documents: DocumentsSliceConfig;
  artifacts: ArtifactsSliceConfigType;
};

const WIKILINK_PATTERN = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
const BODY_TAG_PATTERN = /(^|[^\w/])#([A-Za-z][A-Za-z0-9_-]*)\b/gm;
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

export function buildKnowledgeIndex({
  documents,
  artifacts,
}: BuildKnowledgeIndexProps): KnowledgeIndex {
  const titleToArtifactIds = new Map<string, string[]>();
  for (const artifact of Object.values(artifacts.artifactsById)) {
    if (artifact.type !== 'document') continue;
    const ids = titleToArtifactIds.get(artifact.title) ?? [];
    ids.push(artifact.id);
    titleToArtifactIds.set(artifact.title, ids);
  }

  const index: KnowledgeIndex = {
    linksByArtifactId: {},
    backlinksByArtifactId: {},
    tagsByArtifactId: {},
    unresolvedLinks: [],
  };

  for (const document of Object.values(documents.artifacts)) {
    const artifact = artifacts.artifactsById[document.id];
    if (!artifact || artifact.type !== 'document') continue;

    const sourceTitle = artifact.title;
    const sourceLinks: DocumentLink[] = [];
    index.linksByArtifactId[document.id] = sourceLinks;
    index.tagsByArtifactId[document.id] = extractTags(
      document.id,
      sourceTitle,
      document.markdown,
    );

    for (const targetTitle of extractWikilinkTargets(document.markdown)) {
      const targetArtifactIds = titleToArtifactIds.get(targetTitle) ?? [];
      if (targetArtifactIds.length === 1) {
        const targetArtifactId = targetArtifactIds[0];
        if (!targetArtifactId) continue;
        const link: DocumentLink = {
          sourceArtifactId: document.id,
          sourceTitle,
          targetArtifactId,
          targetTitle,
        };
        sourceLinks.push(link);
        const backlinks =
          index.backlinksByArtifactId[link.targetArtifactId] ?? [];
        backlinks.push(link);
        index.backlinksByArtifactId[link.targetArtifactId] = backlinks;
      } else {
        index.unresolvedLinks.push({
          sourceArtifactId: document.id,
          sourceTitle,
          targetTitle,
          reason: targetArtifactIds.length === 0 ? 'missing' : 'ambiguous',
        });
      }
    }
  }

  return index;
}

function extractWikilinkTargets(markdown: string): string[] {
  return Array.from(markdown.matchAll(WIKILINK_PATTERN))
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

function extractTags(
  artifactId: string,
  title: string,
  markdown: string,
): DocumentTag[] {
  const tags = new Set<string>();
  const frontmatter = FRONTMATTER_PATTERN.exec(markdown);
  if (frontmatter?.[1]) {
    for (const tag of parseFrontmatterTags(frontmatter[1])) {
      tags.add(normalizeTag(tag));
    }
  }

  const body = frontmatter ? markdown.slice(frontmatter[0].length) : markdown;
  for (const match of body.matchAll(BODY_TAG_PATTERN)) {
    const fullMatch = match[0];
    if (
      fullMatch.startsWith('#') &&
      isMarkdownHeading(body, match.index ?? 0)
    ) {
      continue;
    }
    const tag = match[2]?.trim();
    if (tag) tags.add(normalizeTag(tag));
  }

  return Array.from(tags)
    .filter(Boolean)
    .sort()
    .map((tag) => ({artifactId, title, tag}));
}

function isMarkdownHeading(markdown: string, index: number) {
  if (index > 0 && markdown[index - 1] !== '\n') return false;
  return /^#{1,6}\s/.test(markdown.slice(index));
}

function parseFrontmatterTags(frontmatter: string): string[] {
  try {
    const parsed = YAML.parse(frontmatter);
    const tags = parsed?.tags;
    if (Array.isArray(tags)) {
      return tags.filter((tag): tag is string => typeof tag === 'string');
    }
    if (typeof tags === 'string') {
      return tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
  } catch {
    return [];
  }
  return [];
}

function normalizeTag(tag: string) {
  return tag.replace(/^#/, '').trim();
}
