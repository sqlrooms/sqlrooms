import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const packageRoot = path.join(root, 'packages');
const markdownLinkRegex =
  /(?<!!)\[[^\]]+\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
const ignoredSchemes = /^(?:https?:|mailto:|tel:|#)/i;

async function* walk(dir) {
  const entries = await fs.readdir(dir, {withFileTypes: true});
  for (const entry of entries) {
    if (
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === '.turbo'
    ) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      yield fullPath;
    }
  }
}

function stripLinkDecorations(href) {
  return decodeURI(href.replace(/[?#].*$/, ''));
}

const problems = [];

for await (const file of walk(packageRoot)) {
  const markdown = await fs.readFile(file, 'utf8');
  const relativeFile = path.relative(root, file);

  for (const match of markdown.matchAll(markdownLinkRegex)) {
    const href = match[1];
    if (!href || ignoredSchemes.test(href) || path.isAbsolute(href)) {
      continue;
    }

    const targetPath = path.resolve(
      path.dirname(file),
      stripLinkDecorations(href),
    );
    let stat;
    try {
      stat = await fs.stat(targetPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      problems.push({
        file: relativeFile,
        href,
        target: path.relative(root, targetPath),
      });
    }
  }
}

if (problems.length) {
  console.error(
    'Found Markdown links to local directories in package docs. TypeDoc can copy these directories into docs/api/**/_media, including node_modules.',
  );
  for (const problem of problems) {
    console.error(
      `- ${problem.file}: ${problem.href} resolves to ${problem.target}`,
    );
  }
  console.error('Use a file link or an absolute URL instead.');
  process.exit(1);
}

console.log('No package Markdown links to local directories found.');
