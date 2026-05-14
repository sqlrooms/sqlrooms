import fs from 'node:fs';
import path from 'node:path';

const apiDir = path.resolve('docs/api');

function removeDuplicateLeadingTitle(markdown) {
  const match = markdown.match(/^(# .+)\n\n\1\n\n/);
  if (!match) {
    return markdown;
  }

  return markdown.slice(match[0].length - match[1].length - 2);
}

if (fs.existsSync(apiDir)) {
  for (const entry of fs.readdirSync(apiDir, {withFileTypes: true})) {
    if (!entry.isDirectory()) {
      continue;
    }

    const indexPath = path.join(apiDir, entry.name, 'index.md');
    if (!fs.existsSync(indexPath)) {
      continue;
    }

    const originalMarkdown = fs.readFileSync(indexPath, 'utf8');
    const rewrittenMarkdown = removeDuplicateLeadingTitle(originalMarkdown);

    if (rewrittenMarkdown !== originalMarkdown) {
      fs.writeFileSync(indexPath, rewrittenMarkdown);
    }
  }
}
