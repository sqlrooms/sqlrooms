import React, {useState} from 'react';
import {Card, CardContent, CardHeader, CardTitle} from '@sqlrooms/ui';
import {
  ExternalLink,
  FileText,
  Calendar,
  Hash,
  ChevronDown,
} from 'lucide-react';

export interface OpenUrlToolResultProps {
  url: string;
  title?: string;
  content: string;
  metadata?: {
    contentType: string;
    contentLength: number;
    lastModified?: string;
    status: number;
    description?: string;
  };
}

/**
 * Component for displaying the result of the OpenUrl tool
 */
export const OpenUrlToolResult: React.FC<OpenUrlToolResultProps> = ({
  url,
  title,
  content,
  metadata,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };

  const truncateContent = (text: string, maxLength: number = 1000): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const truncateUrl = (url: string, maxLength: number = 50): string => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  };

  return (
    <Card className="w-full">
      <CardHeader
        className="cursor-pointer p-2 pb-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex flex-row gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="font-semibold text-gray-900 dark:text-gray-100">
              <div className="mt-1 flex items-center gap-2">
                🌐 {title || 'Web Content'}
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3" />
                  {truncateUrl(url)}
                </a>
              </div>
            </CardTitle>
          </div>
          <div className="flex items-center">
            <ChevronDown
              className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          {/* Metadata */}
          {metadata && (
            <div className="mb-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
              <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600 dark:text-gray-400">
                    Type:
                  </span>
                  <span className="font-medium">{metadata.contentType}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600 dark:text-gray-400">
                    Size:
                  </span>
                  <span className="font-medium">
                    {formatBytes(metadata.contentLength)}
                  </span>
                </div>

                {metadata.lastModified && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600 dark:text-gray-400">
                      Modified:
                    </span>
                    <span className="font-medium">
                      {formatDate(metadata.lastModified)}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400">
                    Status:
                  </span>
                  <span
                    className={`font-medium ${
                      metadata.status >= 200 && metadata.status < 300
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {metadata.status}
                  </span>
                </div>
              </div>

              {metadata.description && (
                <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {metadata.description}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Content Preview
              </h3>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <div className="max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap font-mono text-xs text-gray-800 dark:text-gray-200">
                  {truncateContent(content)}
                </pre>
              </div>

              {content.length > 1000 && (
                <div className="mt-2 border-t border-gray-200 pt-2 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Content truncated. Full content length:{' '}
                    {content.length.toLocaleString()} characters
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
