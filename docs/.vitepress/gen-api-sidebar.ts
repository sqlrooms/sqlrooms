import fs from 'fs';
import path from 'path';
import {globSync} from 'glob';

// Type for sidebar items based on the structure we've seen
interface SidebarItem {
  text: string;
  link?: string;
  items?: SidebarItem[];
  collapsed?: boolean;
}

function findTypeDocSidebars(apiDir: string): string[] {
  return globSync('**/typedoc-sidebar.json', {
    cwd: apiDir,
    absolute: false,
  });
}

function cleanupLinks(items: SidebarItem[]): SidebarItem[] {
  return items.map((item) => {
    const cleaned: SidebarItem = {...item};

    if (cleaned.link) {
      cleaned.link = cleaned.link.replace('/../../docs', '');
    }

    if (cleaned.items) {
      cleaned.items = cleanupLinks(cleaned.items);
    }

    return cleaned;
  });
}

function loadSidebarContent(filePath: string): SidebarItem[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const items = JSON.parse(content);
  return cleanupLinks(items);
}

function generateApiSidebar(
  docsDir: string,
): NonNullable<SidebarItem['items']> {
  const apiDir = path.join(docsDir, 'api');
  const sidebarFiles = findTypeDocSidebars(apiDir);

  const packages: SidebarItem[] = [];

  for (const sidebarFile of sidebarFiles) {
    console.log(`Generating sidebar for ${sidebarFile}`);
    const packageName = path.dirname(sidebarFile);
    const fullPath = path.join(apiDir, sidebarFile);
    const content = loadSidebarContent(fullPath);

    packages.push({
      text: packageName,
      collapsed: true,
      items: content,
    });
  }

  return packages;
}

// Generate the combined sidebar
const docsDir = path.resolve(__dirname, '..');
const apiSidebar = generateApiSidebar(docsDir);

// Export the sidebar for use in config.ts
export const apiSidebarConfig = apiSidebar;
