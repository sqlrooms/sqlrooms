import {defineConfig} from 'vitepress';
import {apiSidebarConfig} from './gen-api-sidebar';

const CORE_PACKAGES = [
  'core',
  'room-shell',
  'room-config',
  'duckdb',
  'ui',
  'layout',
];
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
      {text: 'Get started', link: '/getting-started'},
      {text: 'Reference', link: '/packages'},
      {text: 'Examples', link: '/examples'},
    ],

    sidebar: [
      {
        text: 'Overview',
        items: [
          {
            text: 'Introduction',
            link: '/overview',
          },
          {
            text: 'Modular Architecture',
            link: '/architecture',
          },
        ],
      },
      {
        text: 'Examples',
        items: [
          {
            text: 'Example Rooms',
            link: '/examples',
          },
          {
            text: 'Case Studies',
            link: '/case-studies',
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
          {
            text: 'How Create a Custom Slice',
            link: '/custom-slice',
          },
          {
            text: 'Theming',
            link: '/theming',
          },
          {
            text: 'Upgrade Guide',
            link: '/upgrade-guide',
          },
        ],
      },

      {
        text: 'Reference',
        items: [
          {
            text: 'Core Packages',
            link: '/packages#core-packages',
            items: apiSidebarConfig.filter((item) =>
              CORE_PACKAGES.includes(item.text),
            ),
          },
          {
            text: 'Feature Packages',
            link: '/packages#feature-packages',
            items: apiSidebarConfig.filter(
              (item) => !CORE_PACKAGES.includes(item.text),
            ),
          },
        ],
      },
    ],

    socialLinks: [
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
