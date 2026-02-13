import {defineConfig} from 'vitepress';
import llmstxt from 'vitepress-plugin-llms';
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
    'ai-rag',
    'ai-settings',
    'canvas',
    'cosmos',
    'data-table',
    'discuss',
    'dropzone',
    'kepler',
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
  vite: {
    plugins: [
      // @ts-ignore
      llmstxt({
        // generateLLMsFullTxt: true,
        // ignoreFiles: ['sponsors/*'],
        // customLLMsTxtTemplate: `# {title}\n\n{foo}`,
        // title: 'Awesome tool',
        // customTemplateVariables: {
        //   foo: 'bar',
        // },
        // experimental: {
        //   depth: 2, // Generate llms.txt and llms-full.txt in root and first-level subdirectories
        // },
      }),
    ],
  },
  ignoreDeadLinks: true,
  title: 'SQLRooms',
  description:
    'An open source React toolkit for human + agent collaborative analytics apps',
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
          {
            text: "What's New",
            link: '/whats-new',
          },
          {
            text: 'Upgrade Guide',
            link: '/upgrade-guide',
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
            text: 'Deployment Scenarios',
            link: '/deployment-scenarios',
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
        items: [
          {
            text: 'Docs for LLMs',
            link: '/llms',
          },
          ...Object.entries(PACKAGE_CATEGORIES).map(([category, packages]) => {
            return {
              text: category,
              link: `/packages#${category.toLowerCase().replace(/ /g, '-')}`,
              items: apiSidebarConfig.filter((item) =>
                packages.includes(item.text),
              ),
            };
          }),
        ],
      },
    ],

    socialLinks: [
      {icon: 'slack', link: '/join-slack'},
      {icon: 'github', link: 'https://github.com/sqlrooms/sqlrooms'},
    ],
  },
  transformHead({page, siteData}: any) {
    const url = `https://sqlrooms.org/${page.relativePath || ''}`
      .replace(/index\.md$/, '')
      .replace(/\.md$/, '.html');

    const frontmatter = page.frontmatter || {};
    const isHome =
      frontmatter.layout === 'home' || page.relativePath === 'index.md';

    const hero = (frontmatter.hero as any) || {};

    const title = isHome
      ? `${hero.name || siteData.title} – ${hero.text || ''}`.trim()
      : page.title || siteData.title;

    const description = isHome
      ? hero.tagline || siteData.description
      : frontmatter.description || siteData.description;

    const image = 'https://sqlrooms.org/sqlrooms-og.webp';

    return [
      ['meta', {property: 'og:type', content: 'website'}],
      ['meta', {property: 'og:title', content: title}],
      ['meta', {property: 'og:description', content: description}],
      ['meta', {property: 'og:image', content: image}],
      ['meta', {property: 'og:url', content: url}],
      ['meta', {name: 'twitter:card', content: 'summary_large_image'}],
      ['meta', {name: 'twitter:title', content: title}],
      ['meta', {name: 'twitter:description', content: description}],
      ['meta', {name: 'twitter:image', content: image}],
    ];
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
