import { useState, useRef, useCallback } from 'react'
import { TEST_CATEGORIES } from '@/lib/test-definitions'
import { testBaitElement, testNetworkResource } from '@/lib/detection-engine'

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
  label: string
  pct: number
  colorClass: string
}

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
  let label: string
  let colorClass: string

  if (pct >= 95) {
    grade = 'A+'
    label = 'Doskonała ochrona!'
    colorClass = 'grade-a'
  } else if (pct >= 85) {
    grade = 'A'
    label = 'Bardzo dobra ochrona'
    colorClass = 'grade-a'
  } else if (pct >= 70) {
    grade = 'B'
    label = 'Dobra ochrona'
    colorClass = 'grade-b'
  } else if (pct >= 50) {
    grade = 'C'
    label = 'Przeciętna ochrona'
    colorClass = 'grade-c'
  } else if (pct >= 30) {
    grade = 'D'
    label = 'Słaba ochrona'
    colorClass = 'grade-d'
  } else {
    grade = 'F'
    label = 'Brak ochrony!'
    colorClass = 'grade-f'
  }

  return { grade, label, pct, colorClass }
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

    // Small delay to let React render the initial state
    await new Promise((r) => setTimeout(r, 50))

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
        const blocked = await testBaitElement(test)
        updateResult(id, blocked ? 'blocked' : 'not-blocked')
      })
    )

    // Run network tests in batches of 10 concurrent tests
    // (higher concurrency is fine — each test uses multiple methods internally)
    const batchSize = 10
    for (let i = 0; i < networkTests.length; i += batchSize) {
      const batch = networkTests.slice(i, i + batchSize)
      await Promise.all(
        batch.map(async ({ id, test }) => {
          const blocked = test.url
            ? await testNetworkResource(test.url)
            : false
          updateResult(id, blocked ? 'blocked' : 'not-blocked')
        })
      )
      // Clear performance entries between batches to avoid buffer overflow
      try {
        performance.clearResourceTimings()
      } catch {
        // ignore
      }
    }

    setIsRunning(false)
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
