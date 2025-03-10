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
  console.log(
    `[DEBUG] findTypeDocSidebars: Searching for typedoc-sidebar.json in ${apiDir}`,
  );
  const sidebarFiles = globSync('**/typedoc-sidebar.json', {
    cwd: apiDir,
    absolute: false,
  });
  console.log(
    `[DEBUG] findTypeDocSidebars: Found ${sidebarFiles.length} sidebar files: ${JSON.stringify(sidebarFiles)}`,
  );
  return sidebarFiles;
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
  console.log(
    `[DEBUG] ensureReadmeContent: Starting with docsDir=${docsDir}, packageNames=${JSON.stringify(packageNames)}`,
  );
  const rootDir = path.resolve(docsDir, '..');
  console.log(
    `[DEBUG] ensureReadmeContent: Root directory resolved to ${rootDir}`,
  );

  for (const packageName of packageNames) {
    console.log(
      `[DEBUG] ensureReadmeContent: Processing package ${packageName}`,
    );
    const packageReadmePath = path.join(
      rootDir,
      'packages',
      packageName,
      'README.md',
    );
    console.log(
      `[DEBUG] ensureReadmeContent: Package README path: ${packageReadmePath}`,
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
      console.log(
        `[DEBUG] ensureReadmeContent: Checking if package directory exists: ${packageDir}`,
      );
      if (!fs.existsSync(packageDir)) {
        console.log(`Package directory not found: ${packageDir}`);
        continue;
      }

      console.log(
        `[DEBUG] ensureReadmeContent: Writing README file to ${packageReadmePath}`,
      );
      fs.writeFileSync(packageReadmePath, minimalReadme);
    } else {
      console.log(
        `[DEBUG] ensureReadmeContent: README already exists for ${packageName}`,
      );
    }
  }
  console.log(`[DEBUG] ensureReadmeContent: Completed processing all packages`);
}

/**
 * Generates the API sidebar and ensures README content is included in each package's API page
 * @param docsDir The docs directory path
 * @returns The sidebar configuration
 */
function generateApiDocs(docsDir: string): NonNullable<SidebarItem['items']> {
  console.log(`[DEBUG] generateApiDocs: Starting with docsDir=${docsDir}`);
  const apiDir = path.join(docsDir, 'api');
  console.log(`[DEBUG] generateApiDocs: API directory path=${apiDir}`);
  const sidebarFiles = findTypeDocSidebars(apiDir);
  console.log(
    `[DEBUG] generateApiDocs: Found ${sidebarFiles.length} sidebar files`,
  );

  // Get unique package names from sidebar files
  const packageNames = new Set<string>();
  for (const sidebarFile of sidebarFiles) {
    const packageName = path.dirname(sidebarFile);
    packageNames.add(packageName);
    console.log(
      `[DEBUG] generateApiDocs: Added package name ${packageName} from ${sidebarFile}`,
    );
  }

  // Convert to array for use in ensureReadmeContent
  const packageNamesArray = Array.from(packageNames);
  console.log(
    `[DEBUG] generateApiDocs: Package names array: ${JSON.stringify(packageNamesArray)}`,
  );

  // Ensure README content is included in each package's API index
  console.log(`[DEBUG] generateApiDocs: Calling ensureReadmeContent`);
  ensureReadmeContent(docsDir, packageNamesArray);

  // Create a simple list of packages with links to their main pages
  const packages: SidebarItem[] = packageNamesArray.map((packageName) => ({
    text: packageName,
    link: `/api/${packageName}/`,
  }));
  console.log(
    `[DEBUG] generateApiDocs: Created ${packages.length} package sidebar items`,
  );

  // Sort packages alphabetically by text
  const sortedPackages = packages.sort((a, b) => a.text.localeCompare(b.text));
  console.log(`[DEBUG] generateApiDocs: Sorted packages alphabetically`);
  console.log(
    `[DEBUG] generateApiDocs: Returning ${sortedPackages.length} sidebar items`,
  );
  return sortedPackages;
}

// Generate the API docs and sidebar
const docsDir = path.resolve(__dirname, '..');
console.log(`[DEBUG] Main: Docs directory resolved to ${docsDir}`);
console.log(`[DEBUG] Main: Calling generateApiDocs`);
const apiSidebar = generateApiDocs(docsDir);
console.log(
  `[DEBUG] Main: Generated API sidebar with ${apiSidebar.length} items`,
);

// Export the sidebar for use in config.ts
export const apiSidebarConfig = apiSidebar;
