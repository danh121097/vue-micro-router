import { defineConfig } from 'vitepress';

// VitePress site for vue-micro-router.
// Source lives in website/ (committed); the internal AK docs/ dir stays private.
export default defineConfig({
  title: 'vue-micro-router',
  description:
    'Mobile-app-style navigation for Vue 3 — animated page stacks, modal dialogs, HUD controls. No URL routing.',
  base: '/',
  ignoreDeadLinks: false,
  appearance: 'dark',
  lastUpdated: true,
  cleanUrls: true,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#6366f1' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'vue-micro-router' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Mobile-app-style navigation for Vue 3 — animated page stacks, modal dialogs, HUD controls.',
      },
    ],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ],

  sitemap: {
    hostname: 'https://vue-micro-router.pages.dev/',
  },

  themeConfig: {
    search: {
      provider: 'local',
    },

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/composables' },
      { text: 'Examples', link: '/examples/' },
      {
        text: 'v1.0.63',
        items: [{ text: 'Changelog', link: '/changelog' }],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Basic Usage', link: '/guide/basic-usage' },
          ],
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Navigation & Routing', link: '/guide/core-concepts' },
            { text: 'Advanced Navigation', link: '/guide/advanced' },
            { text: 'Dialogs', link: '/guide/dialogs' },
            { text: 'GUI Controls & Lifecycle', link: '/guide/controls' },
          ],
        },
        {
          text: 'Extras',
          items: [{ text: 'Audio Manager', link: '/guide/audio' }],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Composables', link: '/api/composables' },
            { text: 'Components', link: '/api/components' },
            { text: 'Plugin Helpers', link: '/api/plugin-helpers' },
            { text: 'Types', link: '/api/types' },
          ],
        },
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [{ text: 'Overview', link: '/examples/' }],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/danh121097/vue-micro-router' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/vue-micro-router' },
    ],

    editLink: {
      pattern:
        'https://github.com/danh121097/vue-micro-router/edit/master/website/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message:
        'Released under the <a href="https://github.com/danh121097/vue-micro-router/blob/master/LICENSE" target="_blank" rel="noopener noreferrer">MIT License</a>.',
      copyright: `Copyright © ${new Date().getFullYear()} - <a href="https://harrynguyen.work" target="_blank" rel="noopener noreferrer">Harry Nguyen</a>`,
    },
  },
});
