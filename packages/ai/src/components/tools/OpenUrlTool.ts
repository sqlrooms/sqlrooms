import {z} from 'zod';
import {extendedTool} from '@openassistant/utils';
import axios, {AxiosError} from 'axios';
import {parse} from 'node-html-parser';
import {AiSliceTool} from '../../AiSlice';
import {OpenUrlToolResult} from './OpenUrlToolResult';

/**
 * Zod schema for the OpenUrl tool parameters
 */
export const OpenUrlToolParameters = z.object({
  url: z.string().url('Invalid URL format'),
  maxSize: z
    .number()
    .optional()
    .default(1024 * 1024), // 1MB default
  extractText: z.boolean().optional().default(true),
  includeMetadata: z.boolean().optional().default(true),
});

export type OpenUrlToolParameters = z.infer<typeof OpenUrlToolParameters>;

export type OpenUrlToolArgs = typeof OpenUrlToolParameters;

export type OpenUrlToolLlmResult = {
  success: boolean;
  details: string;
  title?: string;
  contentLength?: number;
  contentType?: string;
};

export type OpenUrlToolAdditionalData = {
  url: string;
  title?: string;
  content: string;
  metadata?: {
    contentType: string;
    contentLength: number;
    lastModified?: string;
    status: number;
    title?: string;
    description?: string;
  };
};

export type OpenUrlToolContext = unknown;

/**
 * Default description for the OpenUrl tool
 */
export const DEFAULT_OPEN_URL_DESCRIPTION = `A tool for fetching and extracting content from web URLs.
Use this tool to:
- Fetch content from web pages
- Extract readable text from HTML
- Get page metadata (title, content type, etc.)
- Handle various content types and formats

Parameters:
- url: The URL to fetch content from (required)
- maxSize: Maximum content size in bytes (default: 1MB)
- extractText: Whether to extract clean text from HTML (default: true)
- includeMetadata: Whether to include page metadata (default: true)`;

/**
 * Validates and sanitizes a URL for security
 */
function validateUrl(url: string): {
  isValid: boolean;
  error?: string;
  sanitizedUrl?: string;
} {
  try {
    const urlObj = new URL(url);

    // Only allow HTTP and HTTPS protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return {
        isValid: false,
        error: 'Only HTTP and HTTPS protocols are allowed',
      };
    }

    // Block potentially dangerous URLs
    const blockedPatterns = [
      /^localhost/i,
      /^127\.0\.0\.1/i,
      /^0\.0\.0\.0/i,
      /^::1/i,
      /^file:/i,
      /^ftp:/i,
      /^data:/i,
      /^javascript:/i,
      /^vbscript:/i,
    ];

    for (const pattern of blockedPatterns) {
      if (pattern.test(urlObj.href)) {
        return {isValid: false, error: 'URL protocol or hostname not allowed'};
      }
    }

    return {isValid: true, sanitizedUrl: urlObj.href};
  } catch {
    return {isValid: false, error: 'Invalid URL format'};
  }
}

/**
 * Extracts text content from HTML using node-html-parser
 */
function extractTextFromHtml(html: string): string {
  try {
    const root = parse(html);

    // Remove script and style elements
    root
      .querySelectorAll('script, style, noscript')
      .forEach((el) => el.remove());

    // Extract text content
    const textContent = root.text;

    // Clean up whitespace
    return textContent
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  } catch {
    // Fallback to simple regex-based extraction if parsing fails
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

/**
 * Extracts metadata from HTML using node-html-parser
 */
function extractMetadata(html: string): {title?: string; description?: string} {
  try {
    const root = parse(html);

    // Extract title
    const titleElement = root.querySelector('title');
    const title = titleElement?.text?.trim();

    // Extract description from meta tag
    const descriptionElement = root.querySelector('meta[name="description"]');
    const description = descriptionElement?.getAttribute('content')?.trim();

    return {
      title,
      description,
    };
  } catch {
    // Fallback to regex-based extraction if parsing fails
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const descriptionMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i,
    );

    return {
      title: titleMatch?.[1]?.trim(),
      description: descriptionMatch?.[1]?.trim(),
    };
  }
}

/**
 * Fetches content from a URL using axios with proper error handling
 */
async function fetchUrlContent(
  url: string,
  maxSize: number,
  extractText: boolean,
  includeMetadata: boolean,
): Promise<{
  success: boolean;
  content?: string;
  metadata?: {
    contentType: string;
    contentLength: number;
    lastModified?: string;
    status: number;
    title?: string;
    description?: string;
  };
  error?: string;
}> {
  try {
    // Validate URL
    const urlValidation = validateUrl(url);
    if (!urlValidation.isValid) {
      return {success: false, error: urlValidation.error};
    }

    const sanitizedUrl = urlValidation.sanitizedUrl!;

    try {
      const response = await axios.get(sanitizedUrl, {
        timeout: 30000, // 30 second timeout
        maxContentLength: maxSize,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'SQLRooms-OpenUrlTool/1.0',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        responseType: 'text',
        validateStatus: (status: number) => status < 500, // Don't throw for 4xx errors
      });

      const contentType = response.headers['content-type'] || 'text/html';

      // Check if content type is supported
      if (
        !contentType.includes('text/') &&
        !contentType.includes('application/json')
      ) {
        return {
          success: false,
          error: `Unsupported content type: ${contentType}`,
        };
      }

      // Check if response was successful
      if (response.status >= 400) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText || 'Request failed'}`,
        };
      }

      const content = response.data;
      const contentLength = content.length;

      // Check content length
      if (contentLength > maxSize) {
        return {
          success: false,
          error: `Content too large: ${contentLength} bytes (max: ${maxSize})`,
        };
      }

      let processedContent = content;
      const metadata: {
        contentType: string;
        contentLength: number;
        lastModified?: string;
        status: number;
        title?: string;
        description?: string;
      } = {
        contentType,
        contentLength,
        status: response.status,
      };

      if (includeMetadata) {
        metadata.lastModified = response.headers['last-modified'] || undefined;

        if (contentType.includes('text/html')) {
          const extractedMetadata = extractMetadata(content);
          metadata.title = extractedMetadata.title;
          metadata.description = extractedMetadata.description;
        }
      }

      if (extractText && contentType.includes('text/html')) {
        processedContent = extractTextFromHtml(content);
      }

      return {
        success: true,
        content: processedContent,
        metadata,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        if (axiosError.code === 'ECONNABORTED') {
          return {success: false, error: 'Request timeout'};
        }

        if (axiosError.response) {
          return {
            success: false,
            error: `HTTP ${axiosError.response.status}: ${axiosError.response.statusText || 'Request failed'}`,
          };
        }

        if (axiosError.request) {
          return {success: false, error: 'Network error: No response received'};
        }

        return {success: false, error: axiosError.message};
      }

      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Creates an OpenUrl tool for fetching and extracting content from web URLs
 * @param options - Configuration options for the OpenUrl tool
 * @param options.description - Custom description for the tool (defaults to a standard description)
 * @returns A tool that can be used with the AI assistant
 */
export function createOpenUrlTool({
  description = DEFAULT_OPEN_URL_DESCRIPTION,
}: {
  description?: string;
} = {}): AiSliceTool {
  return extendedTool<
    OpenUrlToolArgs,
    OpenUrlToolLlmResult,
    OpenUrlToolAdditionalData,
    OpenUrlToolContext
  >({
    description,
    parameters: OpenUrlToolParameters,
    execute: async ({
      url,
      maxSize = 1024 * 1024,
      extractText = true,
      includeMetadata = true,
    }: OpenUrlToolParameters) => {
      try {
        const result = await fetchUrlContent(
          url,
          maxSize,
          extractText,
          includeMetadata,
        );

        if (!result.success) {
          return {
            llmResult: {
              success: false,
              details: result.error || 'Failed to fetch URL content',
            },
          };
        }

        const {content, metadata} = result;

        return {
          llmResult: {
            success: true,
            details: `Successfully fetched content from ${url}`,
            title: metadata?.title,
            contentLength: content?.length || 0,
            contentType: metadata?.contentType,
          },
          additionalData: {
            url,
            title: metadata?.title,
            content: content || '',
            metadata: includeMetadata ? metadata : undefined,
          },
        };
      } catch (error) {
        return {
          llmResult: {
            success: false,
            details: `Error fetching URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        };
      }
    },
    component: OpenUrlToolResult,
  });
}
