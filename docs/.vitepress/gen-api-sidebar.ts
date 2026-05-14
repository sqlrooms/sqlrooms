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

/**
 * Generates package-level API sidebar entries from TypeDoc output.
 *
 * The main docs sidebar should stay human-curated. TypeDoc symbol pages remain
 * available through package API pages and search, but are intentionally not
 * expanded into the global navigation.
 * @param docsDir The docs directory path
 * @returns The sidebar configuration
 */
function generateApiDocs(docsDir: string): NonNullable<SidebarItem['items']> {
  const apiDir = path.join(docsDir, 'api');
  const sidebarFiles = findTypeDocSidebars(apiDir);

  // Get unique package names from sidebar files
  const packageNames = new Set<string>();
  for (const sidebarFile of sidebarFiles) {
    const packageName = path.dirname(sidebarFile);
    packageNames.add(packageName);
  }

  const packageNamesArray = Array.from(packageNames);

  // Create a simple list of packages with links to their main pages
  const packages: SidebarItem[] = packageNamesArray.map((packageName) => ({
    text: packageName,
    link: `/api/${packageName}/`,
  }));
  // Sort packages alphabetically by text
  return packages.sort((a, b) => a.text.localeCompare(b.text));
}

// Generate the API docs and sidebar
const docsDir = path.resolve(__dirname, '..');
const apiSidebar = generateApiDocs(docsDir);

// Export the sidebar for use in config.ts
export const apiSidebarConfig = apiSidebar;
