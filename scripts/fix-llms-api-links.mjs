import fs from 'node:fs';
import path from 'node:path';

const distApiDir = path.resolve('docs/.vitepress/dist/api');

const apiReferenceDirs = new Set([
  'classes',
  'enumerations',
  'functions',
  'interfaces',
  'namespaces',
  'type-aliases',
  'variables',
]);

function rewriteApiReferenceLinks(packageName, markdown) {
  return markdown.replace(
    /\]\(([^)\s]+\.md)(#[^)]+)?\)/g,
    (match, href, hash = '') => {
      const normalizedHref = href.replace(/^\.\//, '');
      const [firstPathSegment] = normalizedHref.split('/');

      if (!apiReferenceDirs.has(firstPathSegment)) {
        return match;
      }

      return `](/api/${packageName}/${normalizedHref}${hash})`;
    },
  );
}

if (fs.existsSync(distApiDir)) {
  for (const entry of fs.readdirSync(distApiDir, {withFileTypes: true})) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }

    const packageName = entry.name.replace(/\.md$/, '');
    const filePath = path.join(distApiDir, entry.name);
    const originalMarkdown = fs.readFileSync(filePath, 'utf8');
    const rewrittenMarkdown = rewriteApiReferenceLinks(
      packageName,
      originalMarkdown,
    );

    if (rewrittenMarkdown !== originalMarkdown) {
      fs.writeFileSync(filePath, rewrittenMarkdown);
    }
  }
}
