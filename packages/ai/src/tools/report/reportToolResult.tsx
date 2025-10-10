import {FC, useEffect, useMemo, useState, useCallback} from 'react';
import {createRoot} from 'react-dom/client';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import {Button} from '@sqlrooms/ui';
import {Download, FileText, FileCode} from 'lucide-react';
import {QueryDataTable} from '@sqlrooms/data-table';
import {useStoreWithAi} from '@sqlrooms/ai-core';

type ReportToolResultProps = {
  filename: string;
  format: string;
  summary: string;
  toolCallIds?: string[];
};

interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  state: string;
  args?: {
    sqlQuery?: string;
  };
}

export const ReportToolResult: FC<ReportToolResultProps> = ({
  filename,
  format,
  summary,
  toolCallIds = [],
}) => {
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [isBuilding, setIsBuilding] = useState<boolean>(false);
  const [queryResults, setQueryResults] = useState<
    Record<string, {sqlQuery: string; title: string}>
  >({});

  const limitedIds = useMemo(() => toolCallIds.slice(0, 20), [toolCallIds]);

  // Access the AI store to get tool results
  const currentSession = useStoreWithAi((state) =>
    state.ai.getCurrentSession(),
  );

  // Function to find query tool results by tool call ID
  const findQueryToolResult = useCallback(
    (toolCallId: string) => {
      if (!currentSession) return null;

      // Search through all analysis results to find the tool call
      for (const result of currentSession.analysisResults) {
        if (result.streamMessage?.parts) {
          for (const part of result.streamMessage.parts) {
            if (
              part.type === 'tool-invocation' &&
              (part.toolInvocation as ToolInvocation).toolCallId ===
                toolCallId &&
              (part.toolInvocation as ToolInvocation).toolName === 'query' &&
              (part.toolInvocation as ToolInvocation).state === 'result'
            ) {
              return {
                sqlQuery: (part.toolInvocation as ToolInvocation).args
                  ?.sqlQuery as string,
                title: (part.additionalData?.title as string) || 'Query Result',
              };
            }
          }
        }
      }
      return null;
    },
    [currentSession],
  );

  // Initialize query results for tool call IDs
  useEffect(() => {
    const results: Record<string, {sqlQuery: string; title: string}> = {};
    limitedIds.forEach((toolCallId) => {
      const queryResult = findQueryToolResult(toolCallId);
      if (queryResult) {
        results[toolCallId] = {
          sqlQuery: queryResult.sqlQuery,
          title: queryResult.title,
        };
      }
    });
    setQueryResults(results);
    console.debug('[PrintReport] Found query results:', Object.keys(results));
  }, [limitedIds, findQueryToolResult]);

  useEffect(() => {
    let cancelled = false;
    async function build() {
      setIsBuilding(true);
      try {
        // With DOM-clone approach, we keep generated content minimal (summary only)
        let content = summary;
        if (format === 'html') {
          const hasHtmlShell =
            summary.includes('<html') && summary.includes('<body');
          const styles = `
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
          margin: 40px; 
          line-height: 1.6; 
          color: #333;
          padding: 12px;
        }
        pre { 
          margin: 0 !important; 
          padding: 0;
        }
        .max-w-\\[600px\\] {
          max-width: 100% !important;
        }
        div[style*="max-width"] {
          max-width: 100% !important;
        }
        h1, h2, h3 { 
          color: #333; 
          font-weight: 600;
        }
        table {
          border-collapse: collapse;
          width: 100%;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        th {
          background-color: #f2f2f2;
          font-weight: 600;
        }
        `;
          if (hasHtmlShell) {
            content = summary;
          } else {
            content = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>${filename}</title>\n<style>${styles}</style>\n</head>\n<body>\n${summary}\n</body>\n</html>`;
          }
        }
        if (!cancelled) setGeneratedContent(content);
      } finally {
        if (!cancelled) setIsBuilding(false);
      }
    }
    build();
    return () => {
      cancelled = true;
    };
  }, [filename, format, summary, limitedIds]);

  // Render markdown to HTML using the same Markdown component as in-app
  const renderMarkdownToHtml = async (markdown: string): Promise<string> => {
    // Check if the markdown already has HTML shell
    const hasHtmlShell =
      markdown.includes('<html') && markdown.includes('<body');

    if (hasHtmlShell) {
      // If it already has HTML shell, extract the body content and render it
      const bodyMatch = markdown.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch && bodyMatch[1]) {
        const bodyContent = bodyMatch[1];
        const renderedBody = await renderMarkdownContent(bodyContent);
        // Replace the body content with the rendered version
        return markdown.replace(
          /<body[^>]*>[\s\S]*?<\/body>/i,
          `<body>${renderedBody}</body>`,
        );
      }
      return markdown;
    }

    // For content without HTML shell, render the markdown normally
    return await renderMarkdownContent(markdown);
  };

  // Helper function to render markdown content
  const renderMarkdownContent = async (content: string): Promise<string> => {
    const sanitizeMarkdown = (text: string) => {
      return (
        text
          // Remove any DOCTYPE declarations
          .replace(/<!DOCTYPE[^>]*>/gi, '')
          // Remove any <head>...</head>
          .replace(/<head[\s\S]*?<\/head>/gi, '')
          // Remove any <style>...</style>
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          // Remove html/body wrappers
          .replace(/<\/?(?:html|body)[^>]*>/gi, '')
      );
    };

    const input = sanitizeMarkdown(content);
    return await new Promise((resolve) => {
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-10000px';
      container.style.top = '0';
      container.style.width = '0';
      container.style.height = '0';
      const rootEl = document.createElement('div');
      container.appendChild(rootEl);
      document.body.appendChild(container);
      const root = createRoot(rootEl);
      root.render(
        <div className="prose max-w-none">
          <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {input}
          </Markdown>
        </div>,
      );
      // Allow React a frame to commit
      requestAnimationFrame(() => {
        const html = rootEl.innerHTML;
        root.unmount();
        document.body.removeChild(container);
        resolve(html);
      });
    });
  };

  const downloadFile = async () => {
    const content = generatedContent || summary;
    let finalContent = content;
    if (format === 'html') {
      try {
        const hasHtmlShell =
          content.includes('<html') && content.includes('<body');
        const placeholderRegex = /\[\[TOOL:([^\]]+)\]\]/g;
        const placeholderIds: string[] = [];
        // Collect placeholders first for logging
        for (const match of content.matchAll(placeholderRegex)) {
          const token = String(match[1] ?? '').trim();
          if (token && !placeholderIds.includes(token))
            placeholderIds.push(token);
        }
        if (placeholderIds.length > 0) {
          console.debug(
            '[PrintReport] Download: found placeholders',
            placeholderIds,
          );
        }
        const renderedHtml = await renderMarkdownToHtml(content);

        const cloneWithCanvasAsImages = (
          sourceEl: HTMLElement,
        ): HTMLElement => {
          const cloned = sourceEl.cloneNode(true) as HTMLElement;
          const srcCanvases = Array.from(
            sourceEl.querySelectorAll('canvas'),
          ) as HTMLCanvasElement[];
          const dstCanvases = Array.from(
            cloned.querySelectorAll('canvas'),
          ) as HTMLCanvasElement[];
          for (
            let i = 0;
            i < Math.min(srcCanvases.length, dstCanvases.length);
            i++
          ) {
            const src = srcCanvases[i];
            const dst = dstCanvases[i];
            if (!src || !dst) continue;
            try {
              const dataUrl = src.toDataURL('image/png');
              const img = document.createElement('img');
              img.src = dataUrl;
              // Preserve sizing from canvas
              const rect = src.getBoundingClientRect();
              if (rect.width && rect.height) {
                img.width = Math.round(rect.width);
                img.height = Math.round(rect.height);
                img.style.width = `${rect.width}px`;
                img.style.height = `${rect.height}px`;
              } else {
                // fallback to canvas intrinsic size
                if (src.width) img.width = src.width;
                if (src.height) img.height = src.height;
              }
              dst.replaceWith(img);
            } catch {
              console.warn('[PrintReport] Failed to serialize canvas to image');
            }
          }

          // Remove aspect ratio wrappers that create empty space
          const aspectRatioWrappers = cloned.querySelectorAll(
            '[data-radix-aspect-ratio-wrapper]',
          );
          aspectRatioWrappers.forEach((wrapper) => {
            const img = wrapper.querySelector('img');
            if (img) {
              // Create a new container without aspect ratio constraints
              const newContainer = document.createElement('div');
              newContainer.style.position = 'relative';
              newContainer.style.width = '80%';
              newContainer.style.height = 'auto';

              // Clone the image and remove aspect ratio styling
              const clonedImg = img.cloneNode(true) as HTMLImageElement;
              clonedImg.style.position = 'static';
              clonedImg.style.width = '100%';
              clonedImg.style.height = 'auto';
              clonedImg.style.maxWidth = '100%';

              newContainer.appendChild(clonedImg);
              wrapper.replaceWith(newContainer);
            }
          });

          return cloned;
        };

        const resolveHtmlForToken = (token: string): string | null => {
          // First, check for our print report table components (priority)
          const printReportTable = document.querySelector(
            `[data-tool-call-id="${token}"][data-print-report-table="true"]`,
          ) as HTMLElement | null;
          if (printReportTable) {
            console.debug(
              '[PrintReport] Download: found print report table for token',
              token,
            );
            const cloned = cloneWithCanvasAsImages(printReportTable);
            cloned.querySelectorAll('button').forEach((b) => b.remove());
            cloned.querySelectorAll('form').forEach((b) => b.remove());
            cloned.querySelectorAll('details').forEach((b) => b.remove());
            cloned
              .querySelectorAll('input')
              .forEach((input) => input.parentElement?.remove());
            return cloned.outerHTML;
          }

          // Fallback to original logic
          const byDataAttr = document.querySelector(
            `[data-tool-call-id="${token}"]`,
          ) as HTMLElement | null;
          const byId = document.getElementById(token) as HTMLElement | null;
          let source = (byDataAttr || byId) as HTMLElement | null;
          if (!source) {
            const match = String(token).match(/^(.*?)(?:-(\d+))?$/);
            const toolName = match && match[1] ? match[1] : String(token);
            const index =
              match && match[2] ? Math.max(parseInt(match[2], 10) - 1, 0) : -1;
            const candidates = Array.from(
              document.querySelectorAll(`[data-tool-name="${toolName}"]`),
            ) as HTMLElement[];
            if (candidates.length > 0) {
              source =
                index >= 0
                  ? candidates[index] || null
                  : candidates[candidates.length - 1] || null;
            }
          }
          console.debug('[PrintReport] Download: resolve token', token, {
            printReportTable: !!printReportTable,
            byDataAttr: !!byDataAttr,
            byId: !!byId,
            resolved: !!source,
          });
          if (!source) return null;
          const cloned = cloneWithCanvasAsImages(source);
          cloned.querySelectorAll('button').forEach((b) => b.remove());
          cloned.querySelectorAll('form').forEach((b) => b.remove());
          cloned.querySelectorAll('details').forEach((b) => b.remove());
          return cloned.outerHTML;
        };

        const replaced = renderedHtml.replace(placeholderRegex, (_m, id) => {
          const token = String(id).trim();
          console.debug(
            '[PrintReport] Download: processing placeholder for token',
            token,
          );
          const html = resolveHtmlForToken(token);
          if (!html) {
            console.warn(
              '[PrintReport] Download: no source found for token',
              token,
            );
            return `<div data-tool-missing="${token}"></div>`;
          }
          console.debug(
            '[PrintReport] Download: successfully resolved token',
            token,
            'HTML length:',
            html.length,
          );
          return html;
        });

        const getInlineCss = (): string => {
          let css = '';
          const styleSheets = Array.from(
            document.styleSheets,
          ) as CSSStyleSheet[];
          for (const sheet of styleSheets) {
            try {
              const rules = sheet.cssRules || [];
              for (const rule of Array.from(rules)) {
                css += (rule as CSSStyleRule).cssText + '\n';
              }
            } catch {
              // Likely cross-origin stylesheet; skip
              console.warn(
                '[PrintReport] Skipping cross-origin stylesheet while inlining CSS',
              );
            }
          }
          return css;
        };

        // Always ensure we have a proper HTML document structure
        const headAssets = `<style>${getInlineCss()}</style>`;

        if (hasHtmlShell && replaced.includes('</head>')) {
          // Inject inline CSS into existing head
          finalContent = replaced.replace('</head>', `${headAssets}</head>`);
        } else {
          // Build a fresh HTML document with inline project CSS and the rendered HTML
          finalContent = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>${filename}</title>\n${headAssets}\n</head>\n<body>\n${replaced}\n</body>\n</html>`;
        }
      } catch (err) {
        console.error(
          '[PrintReport] Download: error while inlining placeholders',
          err,
        );
        finalContent = content; // fallback to original
      }
    }

    const mimeType = format === 'html' ? 'text/html' : 'text/markdown';
    const blob = new Blob([finalContent], {type: mimeType});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getIcon = () => {
    return format === 'html' ? (
      <FileCode className="h-4 w-4" />
    ) : (
      <FileText className="h-4 w-4" />
    );
  };

  return (
    <div className="rounded-md border border-green-500/50 bg-green-500/10 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getIcon()}
          <span className="text-sm font-medium text-green-700">
            Report Generated Successfully
          </span>
        </div>
      </div>

      <div className="mb-3">
        {isBuilding ? (
          <span className="text-muted-foreground text-xs">
            Preparing content…
          </span>
        ) : null}
        <Button
          onClick={downloadFile}
          className="bg-green-600 text-white hover:bg-green-700"
          size="sm"
        >
          <Download className="mr-2 h-4 w-4" />
          Download {filename}.{format}
        </Button>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-green-600 hover:text-green-700">
          HTML Content
        </summary>
        <div className="mt-2 max-h-[200px] overflow-y-auto rounded-md border border-green-200 bg-white p-3">
          <pre className="whitespace-pre-wrap break-words text-xs text-gray-700">
            {generatedContent || summary}
          </pre>
        </div>
      </details>

      {/* QueryDataTable components for HTML generation - rendered off-screen but functional */}
      <div
        style={{
          position: 'fixed',
          left: '-10000px',
          top: '0',
          width: '800px',
          minHeight: '400px',
          zIndex: -1,
        }}
      >
        {Object.entries(queryResults).map(([toolCallId, result]) => (
          <div
            key={toolCallId}
            id={toolCallId}
            data-tool-call-id={toolCallId}
            data-tool-name="query"
            data-print-report-table="true"
          >
            <div className="p-4">
              <div className="text-muted-foreground bg-muted relative mb-4 max-h-[150px] w-full overflow-auto rounded-md p-2 font-mono text-xs">
                <pre>{result.sqlQuery}</pre>
              </div>
              <h3 className="mb-2 text-lg font-semibold">{result.title}</h3>
              <QueryDataTable query={result.sqlQuery} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
