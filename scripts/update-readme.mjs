import fs from 'fs/promises';

const README_PATH = 'README.md';

function stripFrontmatter(md) {
  const frontmatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n*/;
  return md.replace(frontmatterRegex, '');
}

function adjustRelativePaths(md) {
  return (
    md
      // HTML-style src="media/..."
      .replace(/(src\s*=\s*["'])\/?media\//g, '$1docs/media/')
      // Markdown-style ![...](media/...)
      .replace(/(\]\()\s*\/?media\//g, '$1docs/media/')
      // Convert relative markdown links to absolute links with http://sqlrooms.org/
      // Match [text](relative-path) but not [text](http://...) or [text](https://...) or [text](#anchor) or [text](mailto:...)
      .replace(
        /(\]\()(?!https?:\/\/|#|mailto:)\/?([^)]+)(\))/g,
        '$1http://sqlrooms.org/$2$3',
      )
  );
}

const readmeRaw = await fs.readFile(README_PATH, 'utf-8');

// Find all INCLUDE comments
const includeMatches = [
  ...readmeRaw.matchAll(/<!--\s*INCLUDE:([^\s]+)\s*-->/g),
];
if (includeMatches.length === 0) {
  console.log('❌ No INCLUDE comments found in README.md');
  process.exit(1);
}

console.log(`📝 Found ${includeMatches.length} INCLUDE comment(s)`);

let updatedReadme = readmeRaw;
let hasChanges = false;

// Process each include
for (const match of includeMatches) {
  const filename = match[1];
  const sourcePath = `docs/${filename}`;

  try {
    console.log(`📖 Processing ${filename}...`);

    const sourceRaw = await fs.readFile(sourcePath, 'utf-8');
    const sourceStripped = stripFrontmatter(sourceRaw).trim();
    const sourceFixed = adjustRelativePaths(sourceStripped);

    const regex = new RegExp(
      `<!--\\s*INCLUDE:${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*-->[\\s\\S]*?<!--\\s*END:${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*-->`,
      'm',
    );

    const replacement = `<!-- INCLUDE:${filename} -->\n\n${sourceFixed}\n\n<!-- END:${filename} -->`;
    const newContent = updatedReadme.replace(regex, replacement);

    if (newContent !== updatedReadme) {
      hasChanges = true;
      updatedReadme = newContent;
      console.log(`  ✅ ${filename} processed`);
    } else {
      console.log(`  ℹ️ ${filename} already up to date`);
    }
  } catch (error) {
    console.log(`  ❌ Error reading ${sourcePath}: ${error.message}`);
    process.exit(1);
  }
}

if (hasChanges) {
  await fs.writeFile(README_PATH, updatedReadme);
  console.log(
    '✅ README.md updated with all included content (frontmatter removed, paths adjusted)',
  );
} else {
  console.log('ℹ️ README.md is already up to date.');
}
