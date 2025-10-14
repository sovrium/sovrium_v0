import { themes as prismThemes } from 'prism-react-renderer'
import type { Config } from '@docusaurus/types'
import type * as Preset from '@docusaurus/preset-classic'

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const plugins = []

if (process.env.NODE_ENV === 'production') {
  plugins.push([
    '@docusaurus/plugin-google-gtag',
    {
      trackingID: 'G-GQHS5TXCN1', // your GA4 tracking ID
      anonymizeIP: true, // Optional
    },
  ])
  plugins.push('docusaurus-plugin-hotjar')
}

const config: Config = {
  title: 'LTF Engine',
  tagline: 'Web app generator',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://engine.latechforce.com',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'latechforce', // Usually your GitHub org/user name.
  projectName: 'engine', // Usually your repo name.
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl: 'https://github.com/omnera-dev/omnera/tree/main/website',
        },
        blog: {
          showReadingTime: false,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl: 'https://github.com/omnera-dev/omnera/tree/main/website',
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/android-chrome-512x512.png',
    algolia: {
      appId: 'O9A2Y5CN7H',
      apiKey: '8a0302bcb20acd738753d2d70d17f32b',
      indexName: 'engine-latechforce',
      contextualSearch: true,
      searchParameters: {},
      searchPagePath: 'search',
    },
    hotjar: {
      applicationId: '6416155',
    },
    navbar: {
      title: 'LTF Engine',
      logo: {
        alt: 'LTF Engine Logo',
        src: 'img/android-chrome-512x512.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/guides',
          label: 'Guides',
          position: 'left',
          editUrl: 'https://github.com/omnera-dev/omnera/tree/main/website/src/pages/guides',
        },
        {
          label: 'Experts',
          position: 'left',
          to: '/experts',
          items: [
            {
              label: 'What we do',
              href: '/experts',
            },
            {
              label: 'Our methodology',
              href: '/experts/methodology',
            },
            {
              label: 'Work with us',
              href: '/experts/work-with-us',
            },
            {
              label: 'Join us',
              href: 'https://discord.gg/WzzUZ4XB',
            },
          ],
        },
        { to: '/blog', label: 'Blog', position: 'left' },
        { to: '/schema-explorer', label: 'Schema Explorer', position: 'right' },
        {
          to: '/test-report',
          label: 'Test Report',
          position: 'right',
        },
        {
          href: 'https://github.com/omnera-dev/omnera',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Resources',
          items: [
            {
              label: 'Docs',
              to: '/docs/intro',
            },
            {
              label: 'Guides',
              to: '/guides',
            },
            {
              label: 'Blog',
              to: '/blog',
            },
          ],
        },
        {
          title: 'Experts',
          items: [
            {
              label: 'What we do',
              to: '/experts',
            },
            {
              label: 'Our methodology',
              to: '/experts/methodology',
            },
            {
              label: 'Work with us',
              to: '/experts/work-with-us',
            },
            {
              label: 'Join us',
              href: 'https://discord.gg/WzzUZ4XB',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Schema Explorer',
              to: '/schema-explorer',
            },
            {
              label: 'Test Report',
              to: '/test-report',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/omnera-dev/omnera',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} ESSENTIAL SERVICES.`,
    },
    prism: {
      theme: prismThemes.vsDark,
      darkTheme: prismThemes.vsDark,
    },
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false, // allow user to toggle manually
      respectPrefersColorScheme: true, // this is what you want
    },
  } satisfies Preset.ThemeConfig,

  themes: ['docusaurus-json-schema-plugin'],

  plugins,
}

export default config
