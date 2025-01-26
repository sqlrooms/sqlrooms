import {defineConfig} from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'SQLRooms',
  description: 'SQLRooms – Framework for DuckDB-backed analytics apps',
  base: '/sqlrooms/',
  themeConfig: {
    logo: '/logo.png',
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      {text: 'Home', link: '/'},
      {text: 'Overview', link: '/overview'},
      {text: 'Get started', link: '/getting-started'},
      {text: 'Examples', link: '/examples'},
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
            text: 'Getting started',
            link: '/getting-started',
          },
        ],
      },
      {
        text: 'Reference',
        items: [
          {
            text: 'Package Structure',
            link: '/packages',
          },
        ],
      },
      {
        text: 'Examples',
        items: [
          {
            text: 'Examples Overview',
            link: '/examples',
          },
          {
            text: 'Basic Example (Vite)',
            link: '/examples/#basic-example-vite',
          },
          {
            text: 'AI Analytics (Next.js)',
            link: '/examples#ai-powered-analytics-next-js',
          },
        ],
      },
    ],

    socialLinks: [{icon: 'github', link: 'https://github.com/ilyabo/sqlrooms'}],
  },
});
