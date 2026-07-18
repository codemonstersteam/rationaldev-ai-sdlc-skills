// Чистые ядра готовности плана к Gate #1 (io: none): hasChorePlan/hasForeignPlan + planReadyForApproval
// с durable chore/foreign-планом.
import { test } from "node:test"
import assert from "node:assert/strict"
import { hasChorePlan, hasForeignPlan, planReadyForApproval, isForeignMode, CHORES_DIR, CHORE_PLAN_FILE, FOREIGN_DIR, FOREIGN_PLAN_FILE } from "../enforcement/shared.mjs"

// existsFn инжектится: набор «существующих» rel-путей.
const mkExists = (set) => (rel) => set.has(rel)

test("hasChorePlan: находит docs/chores/<slug>/CHORE-PLAN.md", () => {
  const exists = mkExists(new Set([`${CHORES_DIR}/001-ci/${CHORE_PLAN_FILE}`]))
  assert.equal(hasChorePlan(() => ["001-ci"], exists), true)
})

test("hasChorePlan: нет плана в chore-папке → false", () => {
  const exists = mkExists(new Set([`${CHORES_DIR}/001-ci/notes.md`]))
  assert.equal(hasChorePlan(() => ["001-ci"], exists), false)
})

test("hasChorePlan: нет chore-папок → false (пустой список)", () => {
  assert.equal(hasChorePlan(() => [], mkExists(new Set())), false)
})

test("planReadyForApproval: durable chore-план = план собран", () => {
  const exists = mkExists(new Set([`${CHORES_DIR}/002-bump/${CHORE_PLAN_FILE}`]))
  assert.equal(planReadyForApproval(exists, () => [], () => ["002-bump"]), true)
})

test("planReadyForApproval: plan-review.md = собран (greenfield/rework)", () => {
  const exists = mkExists(new Set([".agent/plan-reviewer/plan-review.md"]))
  assert.equal(planReadyForApproval(exists, () => [], () => []), true)
})

test("planReadyForApproval: slice PLAN.md = собран", () => {
  const exists = mkExists(new Set(["docs/design/slice-01/PLAN.md"]))
  assert.equal(planReadyForApproval(exists, () => ["slice-01"], () => []), true)
})

test("planReadyForApproval: ничего нет → не готов (ранний акцепт не проходит)", () => {
  assert.equal(planReadyForApproval(mkExists(new Set()), () => ["slice-01"], () => ["001-ci"], () => ["001-foo"]), false)
})

test("planReadyForApproval: choreDirsFn опционален (обратная совместимость)", () => {
  const exists = mkExists(new Set([".agent/plan-reviewer/plan-review.md"]))
  assert.equal(planReadyForApproval(exists, () => []), true)
})

// ── foreign-полоса (route-foreign-lane T2) ──────────────────────────────────
test("isForeignMode: 'foreign' → true; прочие/BOM → корректно", () => {
  assert.equal(isForeignMode("foreign"), true)
  assert.equal(isForeignMode("foreign\n"), true)
  assert.equal(isForeignMode("﻿foreign"), true)   // BOM (Windows Set-Content)
  assert.equal(isForeignMode("chore"), false)
  assert.equal(isForeignMode("greenfield"), false)
  assert.equal(isForeignMode(""), false)
  assert.equal(isForeignMode(undefined), false)
})

test("hasForeignPlan: находит docs/foreign/<slug>/FOREIGN-PLAN.md", () => {
  const exists = mkExists(new Set([`${FOREIGN_DIR}/001-extend/${FOREIGN_PLAN_FILE}`]))
  assert.equal(hasForeignPlan(() => ["001-extend"], exists), true)
})

test("hasForeignPlan: папка есть, плана нет → false", () => {
  const exists = mkExists(new Set([`${FOREIGN_DIR}/001-extend/notes.md`]))
  assert.equal(hasForeignPlan(() => ["001-extend"], exists), false)
})

test("hasForeignPlan: нет foreign-папок → false", () => {
  assert.equal(hasForeignPlan(() => [], mkExists(new Set())), false)
})

test("planReadyForApproval: durable foreign-план = план собран", () => {
  const exists = mkExists(new Set([`${FOREIGN_DIR}/002-retune/${FOREIGN_PLAN_FILE}`]))
  assert.equal(planReadyForApproval(exists, () => [], () => [], () => ["002-retune"]), true)
})

test("planReadyForApproval: foreignDirsFn опционален (обратная совместимость)", () => {
  const exists = mkExists(new Set([`${CHORES_DIR}/001-ci/${CHORE_PLAN_FILE}`]))
  assert.equal(planReadyForApproval(exists, () => [], () => ["001-ci"]), true)   // 4-й арг не передан
})
