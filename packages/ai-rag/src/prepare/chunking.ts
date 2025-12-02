/**
 * Chunking utilities for RAG document preparation.
 * Mirrors: python/rag/sqlrooms_rag/prepare/chunking.py
 */

export type ChunkResult = {
  text: string;
  metadata: Record<string, unknown>;
};

/**
 * Estimate token count for text.
 * Uses conservative approximation: ~3 characters per token.
 * This overestimates slightly to ensure we stay under API limits.
 */
export function countTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

/**
 * Markdown-aware chunking options.
 */
export type ChunkMarkdownOptions = {
  /** Max characters per chunk (default: 1500 ~500 tokens) */
  chunkSize?: number;
  /** Overlap between chunks (default: 200) */
  overlap?: number;
  /** Prepend headers to chunks (default: true) */
  includeHeaders?: boolean;
  /** Times to repeat header for weighting (default: 3) */
  headerWeight?: number;
};

/**
 * Markdown-aware chunking.
 * Splits by headers (##, ###) to preserve section context.
 */
export function chunkMarkdown(
  text: string,
  options: ChunkMarkdownOptions = {},
): ChunkResult[] {
  const {
    chunkSize = 1500,
    overlap = 200,
    includeHeaders = true,
    headerWeight = 3,
  } = options;

  const chunks: ChunkResult[] = [];

  // Split by markdown headers
  const headerRegex = /^(#{1,6})\s+(.+)$/gm;
  const sections: Array<{
    level: number;
    title: string;
    content: string;
    headerPath: string;
  }> = [];

  let lastIndex = 0;
  let match;
  const headerStack: Array<{level: number; title: string}> = [];

  while ((match = headerRegex.exec(text)) !== null) {
    // Save previous section content
    if (lastIndex < match.index) {
      const content = text.slice(lastIndex, match.index).trim();
      if (content) {
        const headerPath = headerStack.map((h) => h.title).join(' > ');
        const lastHeader = headerStack[headerStack.length - 1];
        sections.push({
          level: lastHeader ? lastHeader.level : 0,
          title: headerPath,
          content,
          headerPath,
        });
      }
    }

    // Update header stack
    const level = match[1]?.length ?? 1;
    const title = match[2] ?? '';

    // Pop headers of same or higher level
    let lastHeader = headerStack[headerStack.length - 1];
    while (headerStack.length > 0 && lastHeader && lastHeader.level >= level) {
      headerStack.pop();
      lastHeader = headerStack[headerStack.length - 1];
    }
    headerStack.push({level, title});

    lastIndex = match.index + match[0].length;
  }

  // Don't forget the last section
  if (lastIndex < text.length) {
    const content = text.slice(lastIndex).trim();
    if (content) {
      const headerPath = headerStack.map((h) => h.title).join(' > ');
      const lastHeader = headerStack[headerStack.length - 1];
      sections.push({
        level: lastHeader ? lastHeader.level : 0,
        title: headerPath,
        content,
        headerPath,
      });
    }
  }

  // If no headers found, use simple chunking
  if (sections.length === 0) {
    return chunkBySize(text, chunkSize, overlap);
  }

  // Process each section
  for (const section of sections) {
    let sectionText = section.content;

    // Add header weight
    if (includeHeaders && section.title) {
      const headerPrefix =
        Array(headerWeight).fill(section.title).join('\n') + '\n\n';
      sectionText = headerPrefix + sectionText;
    }

    // Split large sections
    if (sectionText.length > chunkSize) {
      const subChunks = chunkBySize(sectionText, chunkSize, overlap);
      for (const subChunk of subChunks) {
        chunks.push({
          text: subChunk.text,
          metadata: {
            ...subChunk.metadata,
            header_path: section.headerPath || undefined,
          },
        });
      }
    } else if (sectionText.trim()) {
      chunks.push({
        text: sectionText,
        metadata: {header_path: section.headerPath || undefined},
      });
    }
  }

  return chunks;
}

/**
 * Simple size-based chunking with overlap.
 * Attempts to break at sentence boundaries.
 */
export function chunkBySize(
  text: string,
  chunkSize: number = 1500,
  overlap: number = 200,
): ChunkResult[] {
  const chunks: ChunkResult[] = [];
  let start = 0;

  while (start < text.length) {
    // Try to break at sentence boundary
    let end = Math.min(start + chunkSize, text.length);

    if (end < text.length) {
      // Look for sentence boundary
      const searchStart = Math.max(end - 100, start);
      const searchText = text.slice(searchStart, end);
      const sentenceEnd = searchText.lastIndexOf('. ');
      if (sentenceEnd > 0) {
        end = searchStart + sentenceEnd + 2;
      }
    }

    const chunkText = text.slice(start, end).trim();
    if (chunkText) {
      chunks.push({
        text: chunkText,
        metadata: {},
      });
    }

    start = end - overlap;
    if (start + overlap >= text.length) break;
  }

  return chunks;
}

/**
 * Validate and split chunks that exceed token limits.
 * Important for OpenAI's 8192 token limit. Uses 5000 for safety margin.
 */
export function validateAndSplitChunks(
  chunks: ChunkResult[],
  maxTokens: number = 5000,
): ChunkResult[] {
  const validated: ChunkResult[] = [];

  for (const chunk of chunks) {
    const tokens = countTokens(chunk.text);

    if (tokens <= maxTokens) {
      validated.push(chunk);
    } else {
      // Split by sentences
      const sentences = chunk.text.split(/(?<=[.!?])\s+/);
      let currentChunk = '';
      let currentTokens = 0;

      for (const sentence of sentences) {
        const sentenceTokens = countTokens(sentence);

        if (sentenceTokens > maxTokens) {
          // Sentence too large, split by character
          const maxChars = maxTokens * 2;
          for (let i = 0; i < sentence.length; i += maxChars) {
            const piece = sentence.slice(i, i + maxChars);
            validated.push({
              text: piece,
              metadata: {...chunk.metadata},
            });
          }
          continue;
        }

        if (currentTokens + sentenceTokens > maxTokens && currentChunk) {
          validated.push({
            text: currentChunk.trim(),
            metadata: {...chunk.metadata},
          });
          currentChunk = sentence;
          currentTokens = sentenceTokens;
        } else {
          currentChunk += ' ' + sentence;
          currentTokens += sentenceTokens;
        }
      }

      if (currentChunk.trim()) {
        validated.push({
          text: currentChunk.trim(),
          metadata: {...chunk.metadata},
        });
      }
    }
  }

  return validated;
}
