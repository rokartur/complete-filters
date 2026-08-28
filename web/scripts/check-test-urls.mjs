/**
 * Liveness check for test URLs. Run from CI, where no ad blocker is installed.
 *
 * Why this matters more than it looks: in a browser, an extension-blocked
 * request and a request to a host that no longer exists both surface as the
 * same opaque network error. Every dead domain left in the definitions is
 * therefore a free "blocked" for every visitor, including those with no blocker
 * at all. There is no client-side fix for that ambiguity, so the list has to be
 * kept honest from outside the browser.
 *
 * Only host reachability is checked. A 404 or 403 on a live host still proves
 * the request reached a server, which is all the browser probes need to tell
 * "blocked" apart from "not blocked".
 */
import { readTestEntries } from './read-test-entries.mjs'

const CONCURRENCY = 24
const TIMEOUT_MS = 8000
const RETRIES = 1

const entries = readTestEntries().filter((entry) => entry.url)

const hosts = new Map()
for (const entry of entries) {
  let hostname
  try {
    hostname = new URL(entry.url).hostname
  } catch {
    continue
  }
  const users = hosts.get(hostname) ?? []
  users.push(entry)
  hosts.set(hostname, users)
}

async function reachOnce(hostname) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    // Any HTTP response proves the host answers. Some hosts reject HEAD, so a
    // failed HEAD falls through to GET before the host is called dead.
    for (const method of ['HEAD', 'GET']) {
      try {
        await fetch(`https://${hostname}/`, {
          method,
          signal: controller.signal,
          redirect: 'manual',
          headers: { 'user-agent': 'complete-filters-url-check' },
        })
        return { alive: true }
      } catch (err) {
        if (method === 'GET') return { alive: false, reason: describe(err) }
      }
    }
    return { alive: false, reason: 'unknown' }
  } finally {
    clearTimeout(timer)
  }
}

function describe(err) {
  if (err?.name === 'AbortError') return 'timeout'
  return err?.cause?.code ?? err?.code ?? err?.message ?? 'unknown'
}

async function isReachable(hostname) {
  let result = await reachOnce(hostname)
  for (let attempt = 0; attempt < RETRIES && !result.alive; attempt++) {
    result = await reachOnce(hostname)
  }
  return result
}

// The machine running this must not filter anything itself. A local Pi-hole or
// NextDNS resolver returns NXDOMAIN for ad hosts, which looks exactly like a
// dead domain and would get live hosts pruned from the definitions.
// Serving subdomains, not apex domains: a filtering resolver leaves the apex
// alone but kills exactly these, so they are the ones worth asking about.
const CONTROL_HOSTS = [
  'securepubads.g.doubleclick.net',
  'pagead2.googlesyndication.com',
  'example.com',
]
const filteredControls = []
for (const hostname of CONTROL_HOSTS) {
  const result = await isReachable(hostname)
  if (!result.alive) filteredControls.push(`${hostname} (${result.reason})`)
}
if (filteredControls.length > 0) {
  console.error(
    'This machine cannot reach hosts that are definitely alive:\n' +
      filteredControls.map((entry) => `  ${entry}`).join('\n') +
      '\n\nA filtering resolver or proxy is in the way, so every result here would\n' +
      'be meaningless. Run this in CI, where nothing is blocked.'
  )
  process.exit(2)
}

const hostnames = [...hosts.keys()]
const dead = []
let checked = 0

async function worker() {
  while (hostnames.length > 0) {
    const hostname = hostnames.pop()
    const result = await isReachable(hostname)
    checked += 1
    if (!result.alive) dead.push({ hostname, reason: result.reason })
  }
}

const workers = []
for (let i = 0; i < CONCURRENCY; i++) workers.push(worker())
await Promise.all(workers)

console.log(`Checked ${checked} hosts across ${entries.length} test URLs.`)

if (dead.length === 0) {
  console.log('✓ All test hosts are reachable.')
  process.exit(0)
}

console.error(
  `\n${dead.length} unreachable host(s). Each one scores as "blocked" for every visitor, including those without a blocker:\n`
)
for (const { hostname, reason } of dead.sort((a, b) => a.hostname.localeCompare(b.hostname))) {
  console.error(`  ${hostname}  (${reason})`)
  for (const entry of hosts.get(hostname)) {
    console.error(`      • ${entry.file}:${entry.name}`)
  }
}
process.exit(1)
