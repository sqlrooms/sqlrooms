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

/**
 * Ensures that each package has a README.md file
 * @param docsDir The docs directory path
 * @param packageNames Array of package names
 */
function ensureReadmeContent(docsDir: string, packageNames: string[]): void {
  const rootDir = path.resolve(docsDir, '..');

  for (const packageName of packageNames) {
    const packageReadmePath = path.join(
      rootDir,
      'packages',
      packageName,
      'README.md',
    );

    // Check if README.md exists for the package
    if (!fs.existsSync(packageReadmePath)) {
      console.log(`README.md not found for package: ${packageName}`);

      // Create a minimal README if it doesn't exist
      const minimalReadme = `# @sqlrooms/${packageName}\n\nThis package is part of the SQLRooms framework.\n`;

      // Create the package README
      console.log(`Creating minimal README for ${packageName}`);

      // Ensure the package directory exists
      const packageDir = path.dirname(packageReadmePath);
      if (!fs.existsSync(packageDir)) {
        console.log(`Package directory not found: ${packageDir}`);
        continue;
      }

      fs.writeFileSync(packageReadmePath, minimalReadme);
    }
  }
}

/**
 * Generates the API sidebar and ensures README content is included in each package's API page
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

  // Convert to array for use in ensureReadmeContent
  const packageNamesArray = Array.from(packageNames);

  // Ensure README content is included in each package's API index
  ensureReadmeContent(docsDir, packageNamesArray);

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
