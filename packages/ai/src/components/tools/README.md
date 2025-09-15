# AI Tools

This directory contains tools that can be used by the AI assistant to perform various tasks.

## OpenUrlTool

The `OpenUrlTool` allows the AI assistant to fetch and analyze content from web URLs. It provides comprehensive functionality for web content retrieval with security and performance considerations.

### Features

- **URL Validation**: Validates URLs and blocks potentially dangerous protocols
- **Content Fetching**: Fetches content from HTTP/HTTPS URLs with proper error handling
- **HTML Parsing**: Extracts clean text from HTML content, removing scripts and styles
- **Metadata Extraction**: Extracts page title, description, content type, and other metadata
- **Size Limits**: Configurable content size limits to prevent memory issues
- **Security**: Blocks localhost, file://, and other potentially dangerous URLs
- **Timeout Handling**: 30-second timeout to prevent hanging requests
- **Error Handling**: Comprehensive error handling for various failure scenarios

### Usage

The tool is automatically available to the AI assistant and can be used with the following parameters:

- `url` (required): The URL to fetch content from
- `maxSize` (optional): Maximum content size in bytes (default: 1MB)
- `extractText` (optional): Whether to extract clean text from HTML (default: true)
- `includeMetadata` (optional): Whether to include page metadata (default: true)

### Security Considerations

- Only HTTP and HTTPS protocols are allowed
- Localhost and local IP addresses are blocked
- File, FTP, data, JavaScript, and VBScript protocols are blocked
- Content size is limited to prevent memory issues
- Requests have a 30-second timeout

### Example

The AI assistant can use this tool like:

```
Use the openUrl tool to fetch the latest news from https://example.com/news
```

The tool will return the extracted content and metadata, which the AI can then analyze and use in its response.
