import { readdir, writeFile, mkdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { existsSync } from 'fs'
import type { AppSchema } from '@/types'
import prettier from 'prettier'
import type { Options } from 'prettier'

interface Guide {
  title: string
  description: string
  category: string
  path: string
  pathWithIndex: string
  code: string
}

const prettierConfig: Options = {
  parser: 'typescript',
  semi: true,
  singleQuote: true,
  trailingComma: 'es5',
}

function replaceLast(str: string, pattern: RegExp, replacement: string) {
  const matches = [...str.matchAll(pattern)]
  if (matches.length === 0) return str

  const lastMatch = matches[matches.length - 1]
  if (!lastMatch) return str

  const start = lastMatch.index
  const end = start + lastMatch[0].length

  return str.slice(0, start) + replacement + str.slice(end)
}

function formatCategoryName(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1)
}

function generateGuideCard(guide: Guide): string {
  return `
    <Link to="/guides/${guide.path}" style={{ width: '100%', display: 'block', textDecoration: 'none' }}>
      <div className="guide-card">
        <span style={{ fontSize: '1rem', color: 'var(--ifm-color-emphasis-600)' }}>${guide.category.charAt(0).toUpperCase() + guide.category.slice(1)}</span>
        <h3 style={{ margin: 0, fontWeight: '500' }}>${guide.title}</h3>
      </div>
    </Link>
  `
}

function generateGuideLink(guide: Guide): string {
  return `
    <Link to="/guides/${guide.path}">
      <p style={{ fontWeight: '400', color: 'var(--ifm-color-primary)', margin: 0 }}>${guide.title}</p>
    </Link>
  `
}

function generateCategorySection(category: string, guides: Guide[]): string {
  return `
  <div>
    ## ${formatCategoryName(category)}

    <hr style={{
      margin: '0.5rem 0',
      border: 'none',
      borderTop: '1px solid var(--ifm-color-emphasis-200)'
    }} />
    <div>
      ${guides.map(generateGuideLink).join('\n')}
    </div>
  </div>
  `
}

function generateBreadcrumb(guide: Guide): string {
  return `
<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--ifm-color-emphasis-600)' }}>
  <Link to="/guides">Guides</Link>
  <span>/</span>
  <Link to="/guides#${guide.category.toLowerCase()}">${formatCategoryName(guide.category)}</Link>
  <span>/</span>
</div>
  `
}

async function getAllFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await getAllFiles(fullPath)))
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      const file = await import(fullPath)
      if (file.inGuides === true) {
        files.push(fullPath)
      }
    }
  }

  return files
}

async function generateGuideFromExample(filePath: string): Promise<Guide> {
  const file = await import(filePath)
  const relativePath = filePath.replace(process.cwd(), '').replace(/^\/example\//, '')
  const category = filePath.match(/(?<=example\/)[^/]+/)?.[0] || 'uncategorized'
  const { name, description, ...schema }: AppSchema = file.default

  const isTypescript = filePath.includes('typescript')
  const isExternals = filePath.includes('externals')
  const isInputData = filePath.includes('input-data')

  const envCode = file.env
    ? `
  process.env = ${JSON.stringify(file.env, null, 2)}
  `
    : ''

  const externalsCode = file.externals
    ? `
  const externals = ${JSON.stringify(
    file.externals,
    (key, value) => {
      if (typeof value === 'function') {
        return value.toString()
      }
      return value
    },
    2
  )}
  `
    : ''

  const code = `
  import { App, type AppSchema ${isTypescript && (isExternals || isInputData) ? ', type CodeContext' : ''} } from '@latechforce/engine'

  ${envCode}
  ${externalsCode}

  const schema: AppSchema = ${JSON.stringify(schema, null, 2)}

  await new App(${isExternals ? '{ externals }' : ''} ).start(schema)`

  let visualCode = replaceLast(code, / }"/g, '})')
    .replace(/"\(\) => {/g, '() => {')
    .replace(/"function\(\) {/g, 'String(function() {')
    .replace(/"function\(context\) {/g, 'String(function(context) {')
    .replace(/ }"/g, '}')
    .replace(/\\n/g, '')
    .replace(/\\"/g, '"')

  if (isTypescript && isInputData) {
    visualCode = visualCode.replace(
      /function\(context\)/g,
      'function(context: CodeContext<{ name: string }>)'
    )
  }

  if (isTypescript && isExternals) {
    visualCode = visualCode.replace(
      /function\(context\)/g,
      'function(context: CodeContext<{}, typeof externals>)'
    )
  }

  // Format the code using Prettier
  const formattedCode = await prettier.format(visualCode, prettierConfig)

  // Extract title from filename (convert kebab-case to Title Case)
  const title = name || 'Untitled'

  return {
    title,
    description: description ?? `Guide for ${title}`,
    category,
    path: relativePath.replace('.ts', '').replace('/index', ''),
    pathWithIndex: relativePath.replace('.ts', ''),
    code: formattedCode.trim(),
  }
}

async function generateGuidePage(guide: Guide, outputDir: string, allGuides: Guide[]) {
  const otherGuides = allGuides.filter((g) => g.path !== guide.path)
  const categories = [...new Set(otherGuides.map((g) => g.category))]

  const mdxContent = `---
title: ${guide.title}
description: ${guide.description}
category: ${guide.category}
---

import Link from '@docusaurus/Link'

${generateBreadcrumb(guide)}

# ${guide.title}

<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '-1rem', marginBottom: '1rem' }}>
  <a href="https://github.com/omnera-dev/omnera/edit/main/example/${guide.pathWithIndex}.ts" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: 'var(--ifm-color-emphasis-600)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" fill="currentColor"/>
    </svg>
    <span>Edit on Github</span>
  </a>
</div>

${guide.description}

\`\`\`typescript title="index.ts"
${guide.code}
\`\`\`

<div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginTop: '72px' }}>
${categories
  .map((category) =>
    generateCategorySection(
      category,
      otherGuides.filter((g) => g.category === category)
    )
  )
  .join('\n')}
</div>
`

  const outputPath = join(outputDir, `${guide.path}.mdx`)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, mdxContent)
}

async function generateIndexPage(guides: Guide[], outputDir: string) {
  const categories = [...new Set(guides.map((g) => g.category))]

  const mdxContent = `---
title: Guides
---

import Link from '@docusaurus/Link'

<style>{\`
  .guide-card {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--ifm-color-emphasis-200);
    padding: 1rem;
    border-radius: 0.5rem;
    background-color: var(--ifm-color-emphasis-0);
    width: 100%;
    transition: border-color 0.2s ease;
  }
  .guide-card:hover {
    border-color: var(--ifm-color-emphasis-400);
  }
\`}</style>

# Guides

A collection of code samples and walkthroughs for configuring and using LTF Engine.

<div style={{ display: 'flex', flexDirection: 'row', gap: '2rem', marginBottom: '2rem' }}>
  ${generateGuideCard(guides.find((g) => g.pathWithIndex.includes('form/index'))!)}
  ${generateGuideCard(guides.find((g) => g.pathWithIndex.includes('trigger/http/post/request-body'))!)}
  ${generateGuideCard(guides.find((g) => g.pathWithIndex.includes('table/index'))!)}
</div>

<div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
${categories
  .map((category) =>
    generateCategorySection(
      category,
      guides.filter((g) => g.category === category)
    )
  )
  .join('\n')}
</div>
`

  await writeFile(join(outputDir, 'index.mdx'), mdxContent)
}

async function updateMainIndexPage(guides: Guide[]) {
  const indexPath = join(process.cwd(), 'website/src/pages/index.mdx')
  const content = await readFile(indexPath, 'utf-8')

  // Remove existing categories section if it exists
  const contentWithoutCategories = content.replace(
    /<div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginTop: '72px' }}>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/main>\s*<\/div>/,
    '</div>\n</div>\n</main>\n</div>'
  )

  const categories = [...new Set(guides.map((g) => g.category))]

  const categoriesSection = `
<div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginTop: '72px' }}>

<div>
# Learn by example

<p style={{ margin: 0 }}>A collection of code samples and walkthroughs for configuring and using LTF Engine.</p>
</div>

${categories
  .map((category) =>
    generateCategorySection(
      category,
      guides.filter((g) => g.category === category)
    )
  )
  .join('\n')}
</div>

</div>
</div>
</main>
</div>`

  const newContent = contentWithoutCategories.replace(
    /<\/div>\s*<\/div>\s*<\/main>\s*<\/div>/,
    categoriesSection
  )

  await writeFile(indexPath, newContent)
}

async function main() {
  const exampleDir = join(process.cwd(), 'example')
  const outputDir = join(process.cwd(), 'website/src/pages/guides')

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true })
  }

  // Get all example files
  const files = await getAllFiles(exampleDir)

  // Generate guides
  const guides = await Promise.all(files.map(generateGuideFromExample))

  // Generate individual guide pages
  await Promise.all(guides.map((guide) => generateGuidePage(guide, outputDir, guides)))

  // Generate index page
  await generateIndexPage(guides, outputDir)

  // Update main index page with categories
  await updateMainIndexPage(guides)
}

main().catch(console.error)
