import fs from 'node:fs'
import path from 'node:path'

const entryRegex =
  /\{\s*name:\s*'([^']+)'(?:,\s*url:\s*'([^']+)')?(?:,\s*baitClass:\s*'([^']+)')?(?:,\s*baitId:\s*'([^']+)')?\s*\}/g

/** Every test entry across the definition files, in file order. */
export function readTestEntries() {
  const definitionsDir = path.resolve(process.cwd(), 'src/lib/test-definitions')
  const files = fs
    .readdirSync(definitionsDir)
    .filter((file) => file.endsWith('.ts') && file !== 'index.ts')
    .sort()

  const entries = []
  for (const file of files) {
    const content = fs.readFileSync(path.join(definitionsDir, file), 'utf8')
    for (const match of content.matchAll(entryRegex)) {
      const [, name, url, baitClass, baitId] = match
      entries.push({ file, name, url, baitClass, baitId })
    }
  }
  return entries
}
