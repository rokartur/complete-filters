import { useState, useRef, useCallback } from 'react'
import { TEST_CATEGORIES } from '@/lib/test-definitions'
import { testBaitElement, testNetworkResource, clearPerfEntryBackup } from '@/lib/detection-engine'
import { initReferenceEngine, initCompleteFiltersEngine, getFilterHint } from '@/lib/reference-engine'
import { checkEnvironment, type EnvironmentCheck } from '@/lib/control-probes'
import { computeGrade, computeStats, type TestStatus } from '@/lib/scoring'

export type { TestStatus, TestStats, GradeInfo } from '@/lib/scoring'
export type { EnvironmentCheck } from '@/lib/control-probes'
export type FilterType = 'all' | 'blocked' | 'not-blocked' | 'inconclusive' | 'pending'

/**
 * Delay between batches — gives Performance API time to finalize entries
 * and prevents batches from overlapping. We don't clear the buffer between
 * batches so 300ms is sufficient for the browser to write entries.
 */
const BATCH_SETTLE_DELAY_MS = 300

/**
 * Batch size for network tests. With AbortController-based cancellation,
 * blocked URLs finish almost instantly (fetch throws → abort all remaining),
 * so larger batches are safe. 8 URLs × 5 methods = 40 concurrent requests,
 * well within browser limits (~256 per domain, 6 per origin for HTTP/1.1).
 */
const BATCH_SIZE = 8

/**
 * How long to wait before the retry pass to let everything settle.
 */
const RETRY_PASS_SETTLE_MS = 800

/**
 * Batch size for the retry pass. Retries run in small parallel batches
 * instead of one-at-a-time for faster completion.
 */
const RETRY_BATCH_SIZE = 4

const TOTAL_TESTS = TEST_CATEGORIES.reduce((sum, category) => sum + category.tests.length, 0)

function createInitialResults(): Record<string, TestStatus> {
  const initial: Record<string, TestStatus> = {}
  TEST_CATEGORIES.forEach((cat) => {
    cat.tests.forEach((_, i) => {
      initial[`${cat.id}-${i}`] = 'pending'
    })
  })
  return initial
}

/** Per-category tallies, the unit the grade is averaged over. */
function categoryTallies(results: Record<string, TestStatus>) {
  return TEST_CATEGORIES.map((category) => {
    const statuses = category.tests.map((_, i) => results[`${category.id}-${i}`])
    return {
      blocked: statuses.filter((status) => status === 'blocked').length,
      notBlocked: statuses.filter((status) => status === 'not-blocked').length,
    }
  })
}

export type TestPhase = 'idle' | 'checking' | 'testing' | 'retrying'

export function useAdBlockTester() {
  const [results, setResults] = useState<Record<string, TestStatus>>(() => createInitialResults())
  const [isRunning, setIsRunning] = useState(false)
  const [phase, setPhase] = useState<TestPhase>('idle')
  const [testedCount, setTestedCount] = useState(0)
  const [filter, setFilter] = useState<FilterType>('all')
  const [environment, setEnvironment] = useState<EnvironmentCheck | null>(null)
  const resultsRef = useRef<Record<string, TestStatus>>(createInitialResults())
  const cancelledRef = useRef(false)

  const stats = computeStats(Object.values(results), TOTAL_TESTS)
  const progress =
    stats.total > 0 ? ((stats.total - stats.pending) / stats.total) * 100 : 0
  const grade =
    stats.pending === 0 && stats.total > 0
      ? computeGrade(categoryTallies(results))
      : null

  const initResults = useCallback(() => {
    const initial = createInitialResults()
    resultsRef.current = initial
    setResults({ ...initial })
    setTestedCount(0)
    // Clear performance entries and backup map from previous runs
    try {
      performance.clearResourceTimings()
    } catch {
      // ignore
    }
    clearPerfEntryBackup()
  }, [])

  const updateResult = useCallback((testId: string, status: TestStatus) => {
    resultsRef.current[testId] = status
    // Batch UI updates - only update React state periodically
    setResults({ ...resultsRef.current })
    setTestedCount((c) => c + 1)
  }, [])

  const getCategoryStats = useCallback(
    (categoryId: string) => {
      const cat = TEST_CATEGORIES.find((c) => c.id === categoryId)
      if (!cat) return { blocked: 0, notBlocked: 0, inconclusive: 0, pending: 0, total: 0 }
      const statuses = cat.tests.map((_, i) => results[`${categoryId}-${i}`])
      return computeStats(statuses, cat.tests.length)
    },
    [results]
  )

  const startTests = useCallback(async () => {
    cancelledRef.current = false
    setIsRunning(true)
    setPhase('checking')
    setTestedCount(0)

    try {
      initResults()

      // Verify the environment before scoring anything. Offline, every probe
      // fails and every failure reads as a block, which would hand out a
      // perfect grade for a browser that cannot reach the internet.
      const env = await checkEnvironment()
      setEnvironment(env)
      if (env.level === 'offline' || cancelledRef.current) return

      setPhase('testing')

      // Load both reference engines in parallel:
      // 1. Prebuilt (EasyList + EasyPrivacy) — fast, provides baseline hints
      // 2. Complete-filters (all filter/*.txt) — provides full coverage
      //    including $domain= restricted rules for accurate detection
      const [referenceResult] = await Promise.allSettled([
        initReferenceEngine(),
        initCompleteFiltersEngine(),
      ])
      // Wait for prebuilt engine (critical for $redirect hints).
      // Complete engine loads in parallel — if it's still loading when tests
      // start, hints will be available for later batches and the retry pass.
      void referenceResult
      await new Promise((r) => setTimeout(r, 50))

      if (cancelledRef.current) return

      const allTests: Array<{
        id: string
        test: (typeof TEST_CATEGORIES)[number]['tests'][number]
      }> = []
      TEST_CATEGORIES.forEach((cat) => {
        cat.tests.forEach((t, i) => {
          allTests.push({ id: `${cat.id}-${i}`, test: t })
        })
      })

      const cosmeticTests = allTests.filter(
        ({ test }) => test.baitClass || test.baitId
      )
      const networkTests = allTests.filter(
        ({ test }) => test.url && !test.baitClass && !test.baitId
      )

      // --- Cosmetic tests (all in parallel — they don't use Performance API) ---
      await Promise.all(
        cosmeticTests.map(async ({ id, test }) => {
          if (cancelledRef.current) return
          try {
            const blocked = await testBaitElement(test)
            if (!cancelledRef.current) {
              updateResult(id, blocked ? 'blocked' : 'not-blocked')
            }
          } catch {
            // The probe itself failed — that is a fact about our code, not
            // about the user's blocker.
            if (!cancelledRef.current) updateResult(id, 'inconclusive')
          }
        })
      )

      // --- Network tests in small batches ---
      // We do NOT clear Performance buffer between batches — the buffer is
      // set to 32000 entries which is enough for all tests. Clearing the
      // buffer caused race conditions where entries from the current batch
      // were lost before redirect detection could read them.
      for (let i = 0; i < networkTests.length; i += BATCH_SIZE) {
        if (cancelledRef.current) break

        const batch = networkTests.slice(i, i + BATCH_SIZE)
        await Promise.all(
          batch.map(async ({ id, test }) => {
            if (cancelledRef.current) return
            try {
              if (test.url) {
                const hint = getFilterHint(test.url)
                const result = await testNetworkResource(test.url, hint)
                if (!cancelledRef.current) updateResult(id, result)
              } else {
                if (!cancelledRef.current) updateResult(id, 'inconclusive')
              }
            } catch {
              if (!cancelledRef.current) updateResult(id, 'inconclusive')
            }
          })
        )

        if (cancelledRef.current) break

        // Settle delay between batches — let Performance API finalize
        await new Promise((r) => setTimeout(r, BATCH_SETTLE_DELAY_MS))
      }

      // --- Retry pass for undecided results ---
      // Re-test every URL that came back "not-blocked" or "inconclusive".
      // The reference engine only covers EasyList/EasyPrivacy (~50K rules), but
      // users may have millions of custom rules that it doesn't know about.
      // Retrying catches:
      // - $redirect rules unknown to the reference engine
      // - Race conditions where redirect detection didn't finish in time
      // - Intermittent Performance API buffer issues
      // - One-off timeouts under the load of the first pass
      // Run in small parallel batches with a fresh Performance buffer.
      if (!cancelledRef.current) {
        setPhase('retrying')

        // Clear buffer and wait for it to settle before retry pass
        try { performance.clearResourceTimings() } catch { /* ignore */ }
        await new Promise((r) => setTimeout(r, RETRY_PASS_SETTLE_MS))

        const retryTargets = networkTests.filter(({ id, test }) => {
          if (!test.url) return false
          const status = resultsRef.current[id]
          return status === 'not-blocked' || status === 'inconclusive'
        })

        for (let i = 0; i < retryTargets.length; i += RETRY_BATCH_SIZE) {
          if (cancelledRef.current) break

          // Clear buffer before each retry batch for clean state
          try { performance.clearResourceTimings() } catch { /* ignore */ }
          await new Promise((r) => setTimeout(r, 100))

          const retryBatch = retryTargets.slice(i, i + RETRY_BATCH_SIZE)
          await Promise.all(
            retryBatch.map(async ({ id, test }) => {
              if (cancelledRef.current) return
              if (!test.url) return
              try {
                const hint = getFilterHint(test.url)
                const result = await testNetworkResource(test.url, hint)
                // A second inconclusive run adds nothing, but a decided one
                // resolves a test the first pass could not.
                const resolvesUndecided =
                  result === 'not-blocked' &&
                  resultsRef.current[id] === 'inconclusive'
                if (!cancelledRef.current && (result === 'blocked' || resolvesUndecided)) {
                  updateResult(id, result)
                }
              } catch {
                // Keep original result on error
              }
            })
          )
        }
      }

      // NOTE: there is deliberately no "upgrade" pass here. Earlier versions
      // marked $domain= and $document tests as blocked based on what this
      // project's own filter lists would do, gated on the user's blocking rate.
      // That scored the lists rather than the user's blocker and inflated every
      // grade. Those rules cannot be exercised from a page, so the detection
      // engine now reports them as inconclusive and they stay out of the score.
    } finally {
      // Final cleanup
      try { performance.clearResourceTimings() } catch { /* ignore */ }
      clearPerfEntryBackup()
      if (!cancelledRef.current) {
        setIsRunning(false)
        setPhase('idle')
      }
    }
  }, [initResults, updateResult])

  const resetTests = useCallback(() => {
    cancelledRef.current = true
    setIsRunning(false)
    setPhase('idle')
    setTestedCount(0)
    initResults()
    setEnvironment(null)
    setFilter('all')
  }, [initResults])

  return {
    categories: TEST_CATEGORIES,
    results,
    stats,
    progress,
    grade,
    environment,
    isRunning,
    phase,
    testedCount,
    totalTests: TOTAL_TESTS,
    filter,
    setFilter,
    startTests,
    resetTests,
    getCategoryStats,
  }
}
