import { useState, useRef, useCallback } from 'react'
import { TEST_CATEGORIES } from '@/lib/test-definitions'
import { testBaitElement, testNetworkResource } from '@/lib/detection-engine'
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

const PERFORMANCE_CLEAR_SETTLE_DELAY_MS = 300

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

export function useAdBlockTester() {
  const [results, setResults] = useState<Record<string, TestStatus>>(() => createInitialResults())
  const [isRunning, setIsRunning] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const resultsRef = useRef<Record<string, TestStatus>>(createInitialResults())

  const stats = computeStats(results)
  const progress =
    stats.total > 0 ? ((stats.total - stats.pending) / stats.total) * 100 : 0
  const grade = stats.pending === 0 && stats.total > 0 ? computeGrade(stats) : null

  const initResults = useCallback(() => {
    const initial = createInitialResults()
    resultsRef.current = initial
    setResults({ ...initial })
    // Clear performance entries from previous runs
    try {
      performance.clearResourceTimings()
    } catch {
      // ignore
    }
  }, [])

  const updateResult = useCallback((testId: string, status: TestStatus) => {
    resultsRef.current[testId] = status
    // Batch UI updates - only update React state periodically
    setResults({ ...resultsRef.current })
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
    setIsRunning(true)
    initResults()

    try {
      // Initialize the reference filter engine in parallel with UI prep.
      // This loads EasyList + EasyPrivacy from Ghostery CDN and provides
      // hints that improve redirect detection accuracy. Non-blocking —
      // if it fails, detection works without hints.
      const referenceReady = initReferenceEngine()

      // Small delay to let React render the initial state
      await new Promise((r) => setTimeout(r, 50))

      // Wait for reference engine (usually loads in <500ms, cached after first load)
      await referenceReady

      // Collect all tests
      const allTests: Array<{
        id: string
        test: (typeof TEST_CATEGORIES)[number]['tests'][number]
      }> = []
      TEST_CATEGORIES.forEach((cat) => {
        cat.tests.forEach((t, i) => {
          allTests.push({ id: `${cat.id}-${i}`, test: t })
        })
      })

      // Run cosmetic tests first (they're fast and don't hit the network)
      const cosmeticTests = allTests.filter(
        ({ test }) => test.baitClass || test.baitId
      )
      const networkTests = allTests.filter(
        ({ test }) => test.url && !test.baitClass && !test.baitId
      )

      // Run cosmetic tests in parallel (no network involved)
      await Promise.all(
        cosmeticTests.map(async ({ id, test }) => {
          try {
            const blocked = await testBaitElement(test)
            updateResult(id, blocked ? 'blocked' : 'not-blocked')
          } catch {
            updateResult(id, 'not-blocked')
          }
        })
      )

      // Run network tests in batches of 15 concurrent tests
      // (higher concurrency is fine — each test uses multiple methods internally)
      const batchSize = 15
      for (let i = 0; i < networkTests.length; i += batchSize) {
        const batch = networkTests.slice(i, i + batchSize)
        await Promise.all(
          batch.map(async ({ id, test }) => {
            try {
              if (test.url) {
                // Get hint from reference engine (instant lookup, no network)
                const hint = getFilterHint(test.url)
                const result = await testNetworkResource(test.url, hint)
                updateResult(id, result)
              } else {
                updateResult(id, 'not-blocked')
              }
            } catch {
              updateResult(id, 'not-blocked')
            }
          })
        )
        // Some underlying detection methods still read Performance API entries
        // briefly after the main test promise resolves. Give them a small grace
        // period before clearing the buffer.
        await new Promise((r) => setTimeout(r, PERFORMANCE_CLEAR_SETTLE_DELAY_MS))

        // Clear performance entries between batches to avoid buffer overflow
        try {
          performance.clearResourceTimings()
        } catch {
          // ignore
        }
      }
    } finally {
      setIsRunning(false)
    }
  }, [initResults, updateResult])

  const resetTests = useCallback(() => {
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
    filter,
    setFilter,
    startTests,
    resetTests,
    getCategoryStats,
  }
}
