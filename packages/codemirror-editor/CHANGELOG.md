# Changelog

All notable changes to this project will be documented in this file.

## [0.28.0] - 2026-02-26

### Added

- 🎉 Initial release of `@sqlrooms/codemirror-editor` package
- ✨ `CodeMirrorEditor` component with JavaScript, JSON, and SQL language support
- ✨ `JsonCodeMirrorEditor` component with full JSON schema validation
- 🎨 Theme integration with SQLRooms theme system (light/dark/system modes)
- 💡 Schema-based autocomplete for JSON property names and enum values
- ✅ Real-time JSON schema validation using ajv
- 🔄 Auto-trigger completions on quote character insertion
- 📝 Line numbers, line wrapping, bracket matching, code folding
- 🎯 Read-only mode support
- 🔧 Extensible via CodeMirror 6 extension system
- 📚 Comprehensive documentation and README
- 🎭 Example application demonstrating all features

### Technical Details

- Bundle size: ~100KB (vs Monaco's ~2MB)
- Built on CodeMirror 6 with modern React patterns
- Uses ajv for JSON schema validation
- Uses jsonc-parser for position tracking in validation errors
- Reuses color utilities from monaco-editor for consistent theming
- Supports all Tailwind CSS variables for theming
