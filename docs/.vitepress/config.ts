import {defineConfig} from 'vitepress';
import {apiSidebarConfig} from './gen-api-sidebar';

const PACKAGE_CATEGORIES = {
  'Core Packages': [
    'ai',
    'core',
    'room-shell',
    'room-store',
    'duckdb',
    'ui',
    'layout',
  ],
  'Feature Packages': [
    'cosmos',
    'data-table',
    'discuss',
    'dropzone',
    'monaco-editor',
    'mosaic',
    'motherduck',
    'recharts',
    's3-browser',
    'schema-tree',
    'sql-editor',
    'vega',
  ],
  'Utility Packages': ['utils'],
};

// https://vitepress.dev/reference/site-config
export default defineConfig({
  ignoreDeadLinks: true,
  title: 'SQLRooms',
  description: 'Build powerful analytics apps with DuckDB',
  base: '/',
  head: [
    ['link', {rel: 'icon', href: '/logo.png'}],
    [
      'meta',
      {
        name: 'google-site-verification',
        content: 'x-FE_DDWM1BS8Eu4JOG0el7pL1gWJgIM-fwFl2EG4OU',
      },
    ],
  ],
  themeConfig: {
    outline: 'deep',
    logo: '/logo.png',
    search: {
      provider: 'local',
    },
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      {text: 'Home', link: '/'},
      {text: 'Overview', link: '/overview'},
      //{text: 'Concepts', link: '/key-concepts'},
      {text: 'Examples', link: '/examples'},
      {text: 'Case Studies', link: '/case-studies'},
      {text: 'Get started', link: '/getting-started'},
      // {
      //   text: 'Join Slack',
      //   link: '/join-slack',
      // },
      // {text: 'Reference', link: '/packages'},
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          {
            text: 'Overview',
            link: '/overview',
          },
          {
            text: 'Key Concepts',
            link: '/key-concepts',
          },
          {
            text: 'Modular Architecture',
            link: '/modular-architecture',
          },
        ],
      },
      {
        text: 'Developer Guide',
        items: [
          {
            text: 'Getting Started',
            link: '/getting-started',
          },
          {
            text: 'State Management',
            link: '/state-management',
          },
          // {
          //   text: 'How Create a Custom Slice',
          //   link: '/custom-slice',
          // },
          {
            text: 'Query Cancellation',
            link: '/query-cancellation',
          },
          {
            text: 'Theming',
            link: '/theming',
          },
          {
            text: 'Offline Use',
            link: '/offline-use',
          },
          {
            text: 'Upgrade Guide',
            link: '/upgrade-guide',
          },
        ],
      },

      {
        text: 'Examples',
        items: [
          {
            text: 'Example Apps',
            link: '/examples',
          },
          {
            text: 'Case Studies',
            link: '/case-studies',
          },
        ],
      },

      {
        text: 'Reference',
        items: Object.entries(PACKAGE_CATEGORIES).map(
          ([category, packages]) => {
            return {
              text: category,
              link: `/packages#${category.toLowerCase().replace(/ /g, '-')}`,
              items: apiSidebarConfig.filter((item) =>
                packages.includes(item.text),
              ),
            };
          },
        ),
      },
    ],

    socialLinks: [
      {icon: 'slack', link: '/join-slack'},
      {icon: 'github', link: 'https://github.com/sqlrooms/sqlrooms'},
    ],
  },
  transformPageData(pageData) {
    const canonicalUrl = `https://sqlrooms.org/${pageData.relativePath}`
      .replace(/index\.md$/, '')
      .replace(/\.md$/, '.html');

    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push([
      'link',
      {rel: 'canonical', href: canonicalUrl},
    ]);
  },
});
