// Чистые ядра готовности плана ТЕКУЩЕЙ задачи к Gate #1 (io: none): planPathUnder + currentGreenfieldSlices
// + planReadyForApproval, привязанные к состоянию прогона (change-dir/chore-dir/slices.md), НЕ к глобу
// durable-артефактов (PLAN.md/CHORE-PLAN.md вечны → «есть хоть один» после первой задачи всегда истинно).
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  planPathUnder, currentGreenfieldSlices, planReadyForApproval, CHORE_PLAN_FILE,
} from "../enforcement/shared.mjs"

// existsFn инжектится: набор «существующих» rel-путей.
const mkExists = (set) => (rel) => set.has(rel)

// ── planPathUnder ────────────────────────────────────────────────────────────
test("planPathUnder: приклеивает файл, обрезает хвостовой слэш/пробелы/CRLF/BOM", () => {
  assert.equal(planPathUnder("docs/design/s/changes/001-x/", "PLAN.md"), "docs/design/s/changes/001-x/PLAN.md")
  assert.equal(planPathUnder("  docs/chores/001-ci\r\n", CHORE_PLAN_FILE), "docs/chores/001-ci/CHORE-PLAN.md")
  assert.equal(planPathUnder("﻿docs/chores/001-ci", CHORE_PLAN_FILE), "docs/chores/001-ci/CHORE-PLAN.md")
})
test("planPathUnder: пустой/пробельный пойнтер → null (работа не в этой полосе)", () => {
  assert.equal(planPathUnder("", "PLAN.md"), null)
  assert.equal(planPathUnder("   \n", "PLAN.md"), null)
  assert.equal(planPathUnder(null, "PLAN.md"), null)
})

// ── currentGreenfieldSlices ──────────────────────────────────────────────────
test("currentGreenfieldSlices: каталог упомянут по имени в slices.md → включён", () => {
  const text = "wirth-slicer → slices.md ready: slice-01-foo, slice-02-bar\n"
  assert.deepEqual(currentGreenfieldSlices(text, ["slice-01-foo", "slice-02-bar"]), ["slice-01-foo", "slice-02-bar"])
})
test("currentGreenfieldSlices: каталог сматчен по slug (Owns package) даже без полного имени", () => {
  const text = "## slice one\nOwns package: internal/foo/\n"
  assert.deepEqual(currentGreenfieldSlices(text, ["slice-01-foo"]), ["slice-01-foo"])
})
test("currentGreenfieldSlices: durable каталог ПРОШЛОЙ задачи (нет в текущем slices.md) отсечён", () => {
  const text = "slices.md ready: slice-01-foo\n"
  assert.deepEqual(currentGreenfieldSlices(text, ["slice-01-foo", "slice-09-legacy"]), ["slice-01-foo"])
})
test("currentGreenfieldSlices: пустой slices.md → [] (нет текущего greenfield-прогона)", () => {
  assert.deepEqual(currentGreenfieldSlices("", ["slice-01-foo"]), [])
  assert.deepEqual(currentGreenfieldSlices("  \n", ["slice-01-foo"]), [])
})

// ── planReadyForApproval — привязка к текущей задаче ──────────────────────────
test("planReadyForApproval: plan-review.md = собран (run-scoped критика @mills — greenfield/SemVer)", () => {
  const exists = mkExists(new Set([".agent/plan-reviewer/plan-review.md"]))
  assert.equal(planReadyForApproval(exists, { sliceDirs: ["slice-01"] }), true)
})
test("planReadyForApproval: SemVer/онбординг — <change-dir>/PLAN.md по пойнтеру = собран", () => {
  const changeDir = "docs/design/slice-01/changes/001-precision"
  const exists = mkExists(new Set([changeDir + "/PLAN.md"]))
  assert.equal(planReadyForApproval(exists, { changeDir }), true)
})
test("planReadyForApproval: chore — <chore-dir>/CHORE-PLAN.md по пойнтеру = собран", () => {
  const choreDir = "docs/chores/002-bump"
  const exists = mkExists(new Set([choreDir + "/CHORE-PLAN.md"]))
  assert.equal(planReadyForApproval(exists, { choreDir }), true)
})
test("planReadyForApproval: greenfield — PLAN.md ТЕКУЩЕГО среза = собран", () => {
  const exists = mkExists(new Set(["docs/design/slice-01-foo/PLAN.md"]))
  assert.equal(planReadyForApproval(exists, { sliceDirs: ["slice-01-foo"] }), true)
})
test("planReadyForApproval: ничего нет → не готов (ранний акцепт не проходит)", () => {
  assert.equal(planReadyForApproval(mkExists(new Set()), { sliceDirs: ["slice-01"], choreDir: "docs/chores/001-ci" }), false)
})
test("planReadyForApproval: опции опциональны (пустой вызов) → false", () => {
  assert.equal(planReadyForApproval(mkExists(new Set())), false)
})

// C1 — ключевой кейс: план ЧУЖОЙ (закрытой) задачи НЕ удовлетворяет проверку текущей.
test("C1: durable PLAN.md закрытого среза не в текущем slices.md → НЕ готов (глоб-защита не воскресает)", () => {
  // Прошлый greenfield оставил вечный docs/design/slice-09-legacy/PLAN.md; текущий прогон — другой срез без плана.
  const exists = mkExists(new Set(["docs/design/slice-09-legacy/PLAN.md"]))
  // sliceDirs текущего прогона (из slices.md) НЕ включает закрытый slice-09-legacy.
  assert.equal(planReadyForApproval(exists, { sliceDirs: ["slice-01-foo"] }), false)
})
test("C1: durable <chore-dir>/CHORE-PLAN.md прошлого chore ≠ текущий chore-dir → НЕ готов", () => {
  // Прошлый chore оставил docs/chores/001-old/CHORE-PLAN.md; текущий chore-dir указывает на 002-new (плана ещё нет).
  const exists = mkExists(new Set(["docs/chores/001-old/CHORE-PLAN.md"]))
  assert.equal(planReadyForApproval(exists, { choreDir: "docs/chores/002-new" }), false)
})
test("C1: durable PLAN.md прошлого change ≠ текущий change-dir → НЕ готов", () => {
  const exists = mkExists(new Set(["docs/design/slice-01/changes/001-old/PLAN.md"]))
  assert.equal(planReadyForApproval(exists, { changeDir: "docs/design/slice-01/changes/002-new" }), false)
})
