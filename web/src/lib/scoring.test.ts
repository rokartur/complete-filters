import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeGrade, computeStats, type TestStatus } from './scoring.ts'

const statuses = (...values: TestStatus[]) => values

test('inconclusive results are counted separately, not as pending', () => {
  const stats = computeStats(
    statuses('blocked', 'not-blocked', 'inconclusive', 'pending'),
    4
  )
  assert.deepEqual(stats, {
    total: 4,
    blocked: 1,
    notBlocked: 1,
    inconclusive: 1,
    pending: 1,
  })
})

test('inconclusive results do not move the grade', () => {
  const decided = computeGrade([{ blocked: 5, notBlocked: 5 }])
  assert.equal(decided?.pct, 50)
  assert.equal(decided?.decided, 10)
})

test('grade averages categories instead of pooling tests', () => {
  // Pooled, this is 51/60 = 85%. Per category it is (50/50 + 1/10) / 2 = 55%,
  // which is what a user who is unprotected in an entire category deserves.
  const grade = computeGrade([
    { blocked: 50, notBlocked: 0 },
    { blocked: 1, notBlocked: 9 },
  ])
  assert.equal(grade?.pct, 55)
  assert.equal(grade?.grade, 'C')
})

test('categories with too few verdicts are left out of the average', () => {
  const grade = computeGrade([
    { blocked: 10, notBlocked: 0 },
    { blocked: 0, notBlocked: 1 },
  ])
  assert.equal(grade?.pct, 100)
  assert.equal(grade?.decided, 10)
})

test('no gradable category yields no grade at all', () => {
  assert.equal(computeGrade([]), null)
  assert.equal(computeGrade([{ blocked: 1, notBlocked: 1 }]), null)
})

test('grade bands map to the documented boundaries', () => {
  const at = (pct: number) =>
    computeGrade([{ blocked: pct, notBlocked: 100 - pct }])?.grade
  assert.equal(at(95), 'A+')
  assert.equal(at(94), 'A')
  assert.equal(at(85), 'A')
  assert.equal(at(70), 'B')
  assert.equal(at(50), 'C')
  assert.equal(at(30), 'D')
  assert.equal(at(29), 'F')
})
