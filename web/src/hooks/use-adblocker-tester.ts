import { useState, useRef, useCallback } from 'react'
import { TEST_CATEGORIES } from '@/lib/test-definitions'
import { testBaitElement, testNetworkResource, clearPerfEntryBackup } from '@/lib/detection-engine'
import { initReferenceEngine, getFilterHint } from '@/lib/reference-engine'

export type TestStatus = 'pending' | 'blocked' | 'not-blocked'
export type FilterType = 'all' | 'blocked' | 'not-blocked' | 'pending'

export interface TestStats {
  total: number
  blocked: number
  notBlocked: number
  pending: number
}

export interface GradeInfo {
  grade: string
  labelKey: 'excellent' | 'veryGood' | 'good' | 'average' | 'weak' | 'none'
  pct: number
  colorClass: string
}

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

function computeStats(results: Record<string, TestStatus>): TestStats {
  const values = Object.values(results)
  const blocked = values.filter((v) => v === 'blocked').length
  const notBlocked = values.filter((v) => v === 'not-blocked').length
  return {
    total: TOTAL_TESTS,
    blocked,
    notBlocked,
    pending: TOTAL_TESTS - blocked - notBlocked,
  }
}

function computeGrade(stats: TestStats): GradeInfo | null {
  const tested = stats.blocked + stats.notBlocked
  if (tested === 0) return null

  const pct = Math.round((stats.blocked / tested) * 100)
  let grade: string
  let labelKey: GradeInfo['labelKey']
  let colorClass: string

  if (pct >= 95) {
    grade = 'A+'
    labelKey = 'excellent'
    colorClass = 'grade-a'
  } else if (pct >= 85) {
    grade = 'A'
    labelKey = 'veryGood'
    colorClass = 'grade-a'
  } else if (pct >= 70) {
    grade = 'B'
    labelKey = 'good'
    colorClass = 'grade-b'
  } else if (pct >= 50) {
    grade = 'C'
    labelKey = 'average'
    colorClass = 'grade-c'
  } else if (pct >= 30) {
    grade = 'D'
    labelKey = 'weak'
    colorClass = 'grade-d'
  } else {
    grade = 'F'
    labelKey = 'none'
    colorClass = 'grade-f'
  }

  return { grade, labelKey, pct, colorClass }
}

export type TestPhase = 'idle' | 'testing' | 'retrying'

export function useAdBlockTester() {
  const [results, setResults] = useState<Record<string, TestStatus>>(() => createInitialResults())
  const [isRunning, setIsRunning] = useState(false)
  const [phase, setPhase] = useState<TestPhase>('idle')
  const [testedCount, setTestedCount] = useState(0)
  const [filter, setFilter] = useState<FilterType>('all')
  const resultsRef = useRef<Record<string, TestStatus>>(createInitialResults())
  const cancelledRef = useRef(false)

  const stats = computeStats(results)
  const progress =
    stats.total > 0 ? ((stats.total - stats.pending) / stats.total) * 100 : 0
  const grade = stats.pending === 0 && stats.total > 0 ? computeGrade(stats) : null

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
      let blocked = 0
      let notBlocked = 0
      let pending = 0
      const cat = TEST_CATEGORIES.find((c) => c.id === categoryId)
      if (!cat) return { blocked, notBlocked, pending, total: 0 }
      cat.tests.forEach((_, i) => {
        const id = `${categoryId}-${i}`
        const status = results[id]
        if (status === 'blocked') blocked++
        else if (status === 'not-blocked') notBlocked++
        else pending++
      })
      return { blocked, notBlocked, pending, total: cat.tests.length }
    },
    [results]
  )

  const startTests = useCallback(async () => {
    cancelledRef.current = false
    setIsRunning(true)
    setPhase('testing')
    setTestedCount(0)

    try {
      initResults()
      const referenceReady = initReferenceEngine()
      await new Promise((r) => setTimeout(r, 50))
      await referenceReady

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
            if (!cancelledRef.current) updateResult(id, 'not-blocked')
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
                if (!cancelledRef.current) updateResult(id, 'not-blocked')
              }
            } catch {
              if (!cancelledRef.current) updateResult(id, 'not-blocked')
            }
          })
        )

        if (cancelledRef.current) break

        // Settle delay between batches — let Performance API finalize
        await new Promise((r) => setTimeout(r, BATCH_SETTLE_DELAY_MS))
      }

      // --- Retry pass for unexpected "not-blocked" results ---
      // After all batches complete, re-test ALL URLs that came back "not-blocked".
      // The reference engine only covers EasyList/EasyPrivacy (~50K rules), but
      // users may have millions of custom rules (e.g., 6M+) that the reference
      // engine doesn't know about. Retrying all not-blocked URLs catches:
      // - $redirect rules unknown to the reference engine
      // - Race conditions where redirect detection didn't finish in time
      // - Intermittent Performance API buffer issues
      // Run in small parallel batches with a fresh Performance buffer.
      if (!cancelledRef.current) {
        setPhase('retrying')

        // Clear buffer and wait for it to settle before retry pass
        try { performance.clearResourceTimings() } catch { /* ignore */ }
        await new Promise((r) => setTimeout(r, RETRY_PASS_SETTLE_MS))

        const retryTargets = networkTests.filter(({ id, test }) => {
          if (!test.url) return false
          return resultsRef.current[id] === 'not-blocked'
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
                if (!cancelledRef.current && result === 'blocked') {
                  updateResult(id, 'blocked')
                }
              } catch {
                // Keep original result on error
              }
            })
          )
        }
      }
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
    setFilter('all')
  }, [initResults])

  return {
    categories: TEST_CATEGORIES,
    results,
    stats,
    progress,
    grade,
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
