/**
 * Scoring for the ad blocker test — deliberately free of DOM and network APIs
 * so it can be exercised by `npm test` (see scoring.test.ts).
 *
 * Two rules drive everything here:
 *
 * 1. Inconclusive results never count. A probe that timed out, was cancelled,
 *    or targeted a rule that cannot be exercised from inside a page tells us
 *    nothing, so it is excluded from the denominator instead of being folded
 *    into "blocked" (which inflated grades) or "not blocked" (which deflated
 *    them).
 * 2. The grade is a macro-average across categories, not a flat ratio over all
 *    tests. Categories differ in size by 5x, so a flat ratio silently weights
 *    the grade toward whichever category happens to have the most URLs.
 */

export type TestStatus = 'pending' | 'blocked' | 'not-blocked' | 'inconclusive'

export interface TestStats {
  total: number
  blocked: number
  notBlocked: number
  inconclusive: number
  pending: number
}

export interface GradeInfo {
  grade: string
  labelKey: 'excellent' | 'veryGood' | 'good' | 'average' | 'weak' | 'none'
  pct: number
  colorClass: string
  /** Tests the grade is actually based on (blocked + not-blocked). */
  decided: number
}

/** Per-category tallies, the unit the grade is averaged over. */
export interface CategoryTally {
  blocked: number
  notBlocked: number
}

export function computeStats(
  statuses: readonly TestStatus[],
  total: number
): TestStats {
  const count = (target: TestStatus) =>
    statuses.filter((status) => status === target).length

  const blocked = count('blocked')
  const notBlocked = count('not-blocked')
  const inconclusive = count('inconclusive')

  return {
    total,
    blocked,
    notBlocked,
    inconclusive,
    pending: total - blocked - notBlocked - inconclusive,
  }
}

const GRADE_BANDS = [
  { min: 95, grade: 'A+', labelKey: 'excellent', colorClass: 'grade-a' },
  { min: 85, grade: 'A', labelKey: 'veryGood', colorClass: 'grade-a' },
  { min: 70, grade: 'B', labelKey: 'good', colorClass: 'grade-b' },
  { min: 50, grade: 'C', labelKey: 'average', colorClass: 'grade-c' },
  { min: 30, grade: 'D', labelKey: 'weak', colorClass: 'grade-d' },
  { min: 0, grade: 'F', labelKey: 'none', colorClass: 'grade-f' },
] as const satisfies ReadonlyArray<{
  min: number
  grade: string
  labelKey: GradeInfo['labelKey']
  colorClass: string
}>

/**
 * Minimum share of a category's tests that must reach a verdict before the
 * category is allowed to influence the grade. A category where 9 of 10 probes
 * were inconclusive would otherwise let a single result stand in for the whole
 * category in the average.
 */
const MIN_CATEGORY_DECIDED = 3

export function computeGrade(
  tallies: readonly CategoryTally[]
): GradeInfo | null {
  const scored = tallies.filter(
    (tally) => tally.blocked + tally.notBlocked >= MIN_CATEGORY_DECIDED
  )
  if (scored.length === 0) return null

  const decided = scored.reduce(
    (sum, tally) => sum + tally.blocked + tally.notBlocked,
    0
  )
  const meanRate =
    scored.reduce(
      (sum, tally) => sum + tally.blocked / (tally.blocked + tally.notBlocked),
      0
    ) / scored.length

  const pct = Math.round(meanRate * 100)
  const band = GRADE_BANDS.find((candidate) => pct >= candidate.min) ?? GRADE_BANDS.at(-1)!

  return {
    grade: band.grade,
    labelKey: band.labelKey,
    pct,
    colorClass: band.colorClass,
    decided,
  }
}
