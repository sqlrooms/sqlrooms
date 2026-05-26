import {defineConfig} from 'vitepress';
import llmstxt from 'vitepress-plugin-llms';
import {apiSidebarConfig} from './gen-api-sidebar';

const SITE_URL = 'https://sqlrooms.org';

function publicUrl(relativePath: string) {
  return `${SITE_URL}/${relativePath || ''}`
    .replace(/index\.md$/, '')
    .replace(/\.md$/, '.html');
}

const PACKAGE_CATEGORIES = {
  'Core Packages': [
    'ai',
    'ai-core',
    'artifacts',
    'db',
    'room-shell',
    'room-store',
    'duckdb',
    'duckdb-core',
    'ui',
    'layout',
  ],
  'Feature Packages': [
    'ai-rag',
    'ai-settings',
    'canvas',
    'cells',
    'codemirror',
    'color-scales',
    'cosmos',
    'crdt',
    'data-table',
    'db-settings',
    'deck',
    'discuss',
    'documents',
    'dropzone',
    'kepler',
    'monaco-editor',
    'mosaic',
    'motherduck',
    'notebook',
    'pivot',
    'recharts',
    's3-browser',
    'schema-tree',
    'sql-editor',
    'vega',
    'webcontainer',
  ],
  'Utility Packages': ['duckdb-node', 'utils'],
};

// https://vitepress.dev/reference/site-config
export default defineConfig({
  vite: {
    plugins: [
      // @ts-ignore
      llmstxt({
        domain: SITE_URL,
        ignoreFiles: [
          // Omit generated media and non-reference pages from all LLM outputs.
          'api/**/_media/**',
          'join-slack.md',
          'packages.md',
        ],
        ignoreFilesPerOutput: {
          // Keep summary bundles focused on package-level docs, while still
          // generating per-symbol .md pages so package references can link to
          // useful markdown targets.
          llmsTxt: [
            'api/**/classes/**',
            'api/**/functions/**',
            'api/**/interfaces/**',
            'api/**/type-aliases/**',
            'api/**/variables/**',
            'api/**/enumerations/**',
            'api/**/namespaces/**',
          ],
          llmsFullTxt: [
            'api/**/classes/**',
            'api/**/functions/**',
            'api/**/interfaces/**',
            'api/**/type-aliases/**',
            'api/**/variables/**',
            'api/**/enumerations/**',
            'api/**/namespaces/**',
          ],
        },
        customLLMsTxtTemplate: `# {title}

{description}

{details}

## Intro for AI assistants

{llm_intro}

## Table of Contents

{toc}`,
        customTemplateVariables: {
          llm_intro: `SQLRooms is a React toolkit for browser-based analytics apps powered by DuckDB.

Use SQLRooms when the task is:
- building a React analytics app with local-first data workflows
- adding SQL query UX (editor + result tables + schema exploration)
- combining analytics UI with AI assistants/tools

Canonical package combos:
- Minimal app: @sqlrooms/room-shell + @sqlrooms/duckdb + @sqlrooms/ui
- SQL + AI app: add @sqlrooms/sql-editor + @sqlrooms/ai + @sqlrooms/ai-settings
- Geospatial app: add @sqlrooms/kepler
- MotherDuck integration: add @sqlrooms/motherduck`,
        },
        // generateLLMsFullTxt: true,
        // ignoreFiles: ['sponsors/*'],
        // title: 'Awesome tool',
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
  sitemap: {
    hostname: SITE_URL,
  },
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
            text: 'Deployment Scenarios',
            link: '/deployment-scenarios',
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
            text: 'State Management',
            link: '/state-management',
          },
          {
            text: 'Commands',
            link: '/commands',
          },
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
  transformHead({pageData, siteData}: any) {
    const url = publicUrl(pageData.relativePath);

    const frontmatter = pageData.frontmatter || {};
    const isHome =
      frontmatter.layout === 'home' || pageData.relativePath === 'index.md';

    const hero = (frontmatter.hero as any) || {};

    const title = isHome
      ? `${hero.name || siteData.title} – ${hero.text || ''}`.trim()
      : pageData.title || siteData.title;

    const description = isHome
      ? hero.tagline || siteData.description
      : frontmatter.description || siteData.description;

    const image = `${SITE_URL}/sqlrooms-og.webp`;

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
    const canonicalUrl = publicUrl(pageData.relativePath);

    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push([
      'link',
      {rel: 'canonical', href: canonicalUrl},
    ]);
  },
});
