# LLMs

This page provides access to machine-readable documentation files for Large Language Models (LLMs) and AI assistants.

## Available Files

### llms.txt

A concise version of the SQLRooms documentation that includes links to additional resources. This version is optimized for LLMs that can follow links and download additional documentation as needed.

**Use this when:**

- Working with AI assistants that can access URLs (like Claude, ChatGPT with browsing)
- You want the LLM to fetch specific documentation on-demand
- You prefer a smaller initial context with the ability to expand

[llms.txt](/llms.txt)

```
https://sqlrooms.org/llms.txt
```

### llms-full.txt

A comprehensive version containing the complete SQLRooms documentation and API reference concatenated into a single file. This includes all content without external links.

**Use this when:**

- Working with AI assistants that cannot access external URLs
- You want all documentation available in a single context
- You need offline access to the complete documentation
- Working with local LLMs or restricted environments

[llms-full.txt](/llms-full.txt)

```
https://sqlrooms.org/llms-full.txt
```

## About These Files

These files are automatically generated from the SQLRooms documentation and API reference using the [vitepress-plugin-llms](https://github.com/davidmyersdev/vitepress-plugin-llms) plugin. They provide structured, machine-readable content that can be used by LLMs and AI assistants to better understand and work with the SQLRooms framework.

The files contain:

- Complete documentation content
- API reference for all packages
- Code examples and usage patterns
- Configuration options and best practices

These resources are particularly useful for:

- AI-assisted development with SQLRooms
- Automated code generation and analysis
- Documentation-aware tooling and integrations
