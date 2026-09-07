import {createRequire} from 'node:module';

interface SidebarItem {
  text: string;
  link?: string;
  items?: SidebarItem[];
  collapsed?: boolean;
}

export interface ApiPackage {
  name: string;
  description: string;
}

export interface ApiPackageCategory {
  text: string;
  packages: ApiPackage[];
}

const require = createRequire(import.meta.url);

/** Package metadata shared by the API landing page and sidebar. */
export const apiPackageCategories =
  require('./api-packages.json') as ApiPackageCategory[];

/** Package-level API sidebar entries grouped by category. */
export const apiSidebarConfig: SidebarItem[] = apiPackageCategories.map(
  (category) => ({
    text: category.text,
    items: [...category.packages]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((packageMetadata) => ({
        text: packageMetadata.name,
        link: `/api/${packageMetadata.name}/`,
      })),
  }),
);
