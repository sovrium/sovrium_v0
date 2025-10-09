import { describe, it, expect } from 'bun:test'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

/**
 * Architecture tests to enforce DDD boundaries and patterns
 * These tests prevent architectural degradation over time
 */

/**
 * Get all TypeScript files in a directory recursively
 */
function getTypeScriptFiles(dir: string, basePath = ''): string[] {
  const files: string[] = []
  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    const relativePath = basePath ? join(basePath, entry.name) : entry.name

    if (entry.isDirectory()) {
      files.push(...getTypeScriptFiles(fullPath, relativePath))
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(relativePath)
    }
  }

  return files
}

/**
 * Get import statements from a TypeScript file
 */
function getImports(filePath: string): string[] {
  const fullPath = join(process.cwd(), 'src', filePath)
  try {
    const content = readFileSync(fullPath, 'utf-8')
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g
    const imports: string[] = []
    let match

    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]!)
    }

    return imports
  } catch {
    // File doesn't exist, return empty array
    return []
  }
}

/**
 * Normalize a path by repeatedly removing ../ and ./ until no more can be removed
 * This prevents path injection vulnerabilities from incomplete sanitization
 */
function normalizePath(path: string): string {
  let normalized = path
  let previousLength = 0

  // Keep applying replacements until the string stops changing
  while (normalized.length !== previousLength) {
    previousLength = normalized.length
    normalized = normalized.replace(/\.\.\//g, '').replace(/\.\//g, '')
  }

  return normalized
}

/**
 * Check if a path represents a cross-feature import
 */
function isCrossFeatureImport(importPath: string, currentFeature: string): boolean {
  // Skip relative imports that don't go up directories
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    // Check if it goes to a different feature
    const normalizedPath = normalizePath(importPath)
    return (
      normalizedPath.includes('features/') &&
      !normalizedPath.includes(`features/${currentFeature}/`)
    )
  }

  // Skip external packages (node_modules)
  if (!importPath.startsWith('../')) {
    return false
  }

  // Check for cross-feature imports through relative paths
  const pathParts = importPath.split('/')
  const featureIndex = pathParts.findIndex((part) => part === 'features')
  if (featureIndex !== -1 && featureIndex + 1 < pathParts.length) {
    const importedFeature = pathParts[featureIndex + 1]
    return importedFeature !== currentFeature
  }

  return false
}

/**
 * Extract feature name from file path
 */
function getFeatureFromPath(filePath: string): string | null {
  const parts = filePath.split('/')
  const featuresIndex = parts.findIndex((part) => part === 'features')
  if (featuresIndex !== -1 && featuresIndex + 1 < parts.length) {
    return parts[featuresIndex + 1]!
  }
  return null
}

/**
 * Check if a file is in the domain layer
 */
function isDomainLayer(filePath: string): boolean {
  return filePath.includes('/domain/')
}

/**
 * Check if a file is in the application layer
 */
function isApplicationLayer(filePath: string): boolean {
  return filePath.includes('/application/')
}

/**
 * Check if a file is in the infrastructure layer
 */
function isInfrastructureLayer(filePath: string): boolean {
  return filePath.includes('/infrastructure/')
}

describe('Architecture Rules', () => {
  const srcDir = join(process.cwd(), 'src')

  it('should not have cross-feature imports in domain layer', () => {
    const domainFiles = getTypeScriptFiles(join(srcDir, 'features')).filter((filePath) =>
      isDomainLayer(filePath)
    )

    const violations: string[] = []

    for (const file of domainFiles) {
      const feature = getFeatureFromPath(file)
      if (!feature) continue

      const imports = getImports(file)
      for (const importPath of imports) {
        if (isCrossFeatureImport(importPath, feature)) {
          violations.push(`${file} imports from different feature: ${importPath}`)
        }
      }
    }

    if (violations.length > 0) {
      console.log('Cross-feature import violations in domain layer:')
      violations.forEach((violation) => console.log(`  - ${violation}`))
    }

    expect(violations).toHaveLength(0)
  })

  it('should not import infrastructure from domain layer', () => {
    const domainFiles = getTypeScriptFiles(join(srcDir, 'features')).filter((filePath) =>
      isDomainLayer(filePath)
    )

    const violations: string[] = []

    for (const file of domainFiles) {
      const imports = getImports(file)
      for (const importPath of imports) {
        if (importPath.includes('/infrastructure/')) {
          violations.push(`${file} imports infrastructure: ${importPath}`)
        }
      }
    }

    if (violations.length > 0) {
      console.log('Infrastructure import violations in domain layer:')
      violations.forEach((violation) => console.log(`  - ${violation}`))
    }

    expect(violations).toHaveLength(0)
  })

  it('should not import application from domain layer', () => {
    const domainFiles = getTypeScriptFiles(join(srcDir, 'features')).filter((filePath) =>
      isDomainLayer(filePath)
    )

    const violations: string[] = []

    for (const file of domainFiles) {
      const imports = getImports(file)
      for (const importPath of imports) {
        if (importPath.includes('/application/')) {
          violations.push(`${file} imports application: ${importPath}`)
        }
      }
    }

    if (violations.length > 0) {
      console.log('Application import violations in domain layer:')
      violations.forEach((violation) => console.log(`  - ${violation}`))
    }

    expect(violations).toHaveLength(0)
  })

  it('should have domain entities that do not depend on external API types', () => {
    const domainFiles = getTypeScriptFiles(join(srcDir, 'features')).filter(
      (filePath) => isDomainLayer(filePath) && filePath.includes('entity')
    )

    const violations: string[] = []

    for (const file of domainFiles) {
      const imports = getImports(file)
      for (const importPath of imports) {
        // Check for direct imports of external API types
        if (
          importPath.includes('integrations/') &&
          (importPath.includes('.types') || importPath.includes('types.'))
        ) {
          violations.push(`${file} directly imports external API types: ${importPath}`)
        }
      }
    }

    if (violations.length > 0) {
      console.log('External API type import violations in domain entities:')
      violations.forEach((violation) => console.log(`  - ${violation}`))
    }

    expect(violations).toHaveLength(0)
  })

  it('should have proper aggregate boundaries', () => {
    // Define expected aggregate boundaries based on existing features
    const aggregateBoundaries = {
      table: ['record', 'field'],
      automation: ['action', 'trigger'],
      bucket: ['object'],
      connection: ['token'],
      app: ['user'],
      run: [],
      form: [],
    }

    const violations: string[] = []

    for (const [aggregateRoot] of Object.entries(aggregateBoundaries)) {
      const aggregateFiles = getTypeScriptFiles(join(srcDir, 'features', aggregateRoot)).filter(
        (filePath) => isDomainLayer(filePath)
      )

      for (const file of aggregateFiles) {
        const imports = getImports(file)
        for (const importPath of imports) {
          // Check for imports from other aggregates
          for (const [otherAggregate, otherEntities] of Object.entries(aggregateBoundaries)) {
            if (otherAggregate === aggregateRoot) continue

            if (importPath.includes(`features/${otherAggregate}/domain/entity/`)) {
              // Allow imports only through aggregate root or if it's in allowed entities
              const importedEntity = importPath.split('/').pop()?.replace('.entity.ts', '')
              if (
                importedEntity &&
                importedEntity !== otherAggregate &&
                !otherEntities.includes(importedEntity as never)
              ) {
                violations.push(`${file} imports from different aggregate: ${importPath}`)
              }
            }
          }
        }
      }
    }

    if (violations.length > 0) {
      console.log('Aggregate boundary violations:')
      violations.forEach((violation) => console.log(`  - ${violation}`))
    }

    // Allow some violations for now as we're migrating to this architecture
    expect(violations.length).toBeLessThanOrEqual(10)
  })

  it('should use anti-corruption layers for external integrations', () => {
    const applicationFiles = getTypeScriptFiles(join(srcDir, 'features')).filter(
      (filePath) => isApplicationLayer(filePath) || isInfrastructureLayer(filePath)
    )

    const violations: string[] = []

    for (const file of applicationFiles) {
      const imports = getImports(file)
      for (const importPath of imports) {
        // Check for direct imports of external integration types
        if (importPath.includes('shared/integrations/') && importPath.includes('.types')) {
          // This should use anti-corruption layer instead
          violations.push(`${file} directly imports integration types: ${importPath}`)
        }
      }
    }

    if (violations.length > 0) {
      console.log('Direct integration type import violations (should use anti-corruption layers):')
      violations.forEach((violation) => console.log(`  - ${violation}`))
    }

    // Allow some violations for now as we're implementing anti-corruption layers
    expect(violations.length).toBeLessThanOrEqual(20)
  })
})
