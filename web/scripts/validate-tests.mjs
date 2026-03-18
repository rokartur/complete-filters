import fs from 'node:fs'
import path from 'node:path'

const definitionsDir = path.resolve(process.cwd(), 'src/lib/test-definitions')
const files = fs
  .readdirSync(definitionsDir)
  .filter((file) => file.endsWith('.ts') && file !== 'index.ts')
  .sort()

const entryRegex = /\{\s*name:\s*'([^']+)'(?:,\s*url:\s*'([^']+)')?(?:,\s*baitClass:\s*'([^']+)')?(?:,\s*baitId:\s*'([^']+)')?\s*\}/g

const disallowedUrlPatterns = [
  {
    label: 'example-domain',
    regex: /example\./i,
  },
  {
    label: 'placeholder-X',
    regex: /X{4,}/,
  },
  {
    label: 'fundingchoices-placeholder',
    regex: /pub-0{8,}/,
  },
  {
    label: 'gravatar-placeholder',
    regex: /avatar\/0{16,}/,
  },
  {
    label: 'crazyegg-placeholder',
    regex: /\/0000\/0000\.js$/,
  },
]

const entries = []

for (const file of files) {
  const content = fs.readFileSync(path.join(definitionsDir, file), 'utf8')
  for (const match of content.matchAll(entryRegex)) {
    const [, name, url, baitClass, baitId] = match
    entries.push({ file, name, url, baitClass, baitId })
  }
}

const duplicateUrls = new Map()
for (const entry of entries) {
  if (!entry.url) continue
  const current = duplicateUrls.get(entry.url) ?? []
  current.push(`${entry.file}:${entry.name}`)
  duplicateUrls.set(entry.url, current)
}

const duplicateUrlFailures = [...duplicateUrls.entries()].filter(([, refs]) => refs.length > 1)

const invalidUrlFailures = []
for (const entry of entries) {
  if (!entry.url) continue
  for (const rule of disallowedUrlPatterns) {
    if (rule.regex.test(entry.url)) {
      invalidUrlFailures.push({
        file: entry.file,
        name: entry.name,
        url: entry.url,
        reason: rule.label,
      })
    }
  }
}

if (duplicateUrlFailures.length === 0 && invalidUrlFailures.length === 0) {
  console.log(`✓ Test definitions validated successfully (${entries.length} entries checked)`)
  process.exit(0)
}

console.error('Test definition validation failed.\n')

if (duplicateUrlFailures.length > 0) {
  console.error('Duplicate URLs:')
  for (const [url, refs] of duplicateUrlFailures) {
    console.error(`  - ${url}`)
    for (const ref of refs) {
      console.error(`      • ${ref}`)
    }
  }
  console.error('')
}

if (invalidUrlFailures.length > 0) {
  console.error('Invalid or placeholder-like URLs:')
  for (const failure of invalidUrlFailures) {
    console.error(
      `  - [${failure.reason}] ${failure.file}:${failure.name} -> ${failure.url}`
    )
  }
  console.error('')
}

process.exit(1)