// close-run pure core: planClose (guards + tag delegation) · ledgerEntry (self-sufficient) ·
// wipeTargets (B1 инверсия) · tagPlan (B2) · releaseNotes (B3) · debtToRemove (B4).
import { test } from "node:test"
import assert from "node:assert/strict"
import { planClose, ledgerEntry, WIPE_KEEP, wipeTargets, tagPlan, releaseNotes, debtToRemove } from "../close-run.mjs"

const bump = ({ weight, files }) =>
  weight === "patch" && files.some((f) => f.startsWith("src/")) ? { tag: "0.1.0", reason: "seed" }
  : { tag: null, reason: "no-bump: plumbing" }

test("planClose: guards — gate2, merge, weight — each STOPs", () => {
  assert.match(planClose({ gate2: false, merged: true, weight: "patch", bump }).stop, /Gate #2/)
  assert.match(planClose({ gate2: true, merged: false, weight: "patch", bump }).stop, /not merged/)
  assert.match(planClose({ gate2: true, merged: true, weight: "", bump }).stop, /weight/)
})

test("planClose: all guards pass → delegates the tag decision, no own arithmetic", () => {
  const r = planClose({ gate2: true, merged: true, weight: "patch", files: ["src/x.java"], tags: [], bump })
  assert.equal(r.stop, null)
  assert.equal(r.tag, "0.1.0")
})

test("planClose: plumbing → null tag is NOT a stop (normal outcome)", () => {
  const r = planClose({ gate2: true, merged: true, weight: "patch", files: [".github/ci.yml"], tags: [], bump })
  assert.equal(r.stop, null)
  assert.equal(r.tag, null)
})

test("ledgerEntry: self-sufficient — task text inline, survives change-dir deletion", () => {
  const e = ledgerEntry({ ts: "2026-01-01T00:00:00Z", slug: "fix-x", weight: "patch",
    pr: "https://…/pull/2", mergeSha: "abc123", tag: "0.1.0", reason: "seed", task: "fix leaked set" })
  assert.match(e, /fix-x/); assert.match(e, /patch/); assert.match(e, /abc123/)
  assert.match(e, /fix leaked set/, "task described in text, not by a link into the change-dir")
})

test("ledgerEntry: no tag → records the no-bump reason, not an empty tag", () => {
  const e = ledgerEntry({ ts: "t", slug: "s", weight: "patch", pr: "p", mergeSha: "m", tag: null, reason: "plumbing" })
  assert.match(e, /no-bump: plumbing/)
})

// ── B1 · вайп-инверсия — сносим .agent/ целиком, кроме белого списка ──────────────
test("B1 wipeTargets: белый список = только decisions.log (memory.md НЕ переживает)", () => {
  assert.deepEqual(WIPE_KEEP, [".agent/decisions.log"], "трасса переживает; рабочая память memory.md — нет")
})

test("B1 wipeTargets: сносит ВСЁ run-state, включая новые папки (plan-reviewer, release-health)", () => {
  // именно эти папки старый список WIPE не покрывал — теперь подметаются инверсией
  const entries = ["gates", "planner", "plan-reviewer", "release-health", "vcs", "decisions.log"]
  const out = wipeTargets(entries)
  assert.ok(out.includes(".agent/gates"))
  assert.ok(out.includes(".agent/plan-reviewer"), "новая папка ревьюера подметается без правки списка")
  assert.ok(out.includes(".agent/release-health"), "новая папка канарейки подметается")
  assert.ok(out.includes(".agent/planner"))
  assert.ok(!out.includes(".agent/decisions.log"), "трасса не сносится")
})

test("B1 wipeTargets: пустой .agent/ → нечего сносить", () => {
  assert.deepEqual(wipeTargets([]), [])
})

// ── B2 · TAG_EXISTS → отказ ───────────────────────────────────────────────────────
test("B2 tagPlan: тег уже на форже → STOP, не перезаписываем историю версий", () => {
  const r = tagPlan({ tag: "1.2.0", existsOnForge: true })
  assert.match(r.stop, /уже на форже|отказ/)
  assert.notEqual(r.push, true)
})

test("B2 tagPlan: тега нет на форже → ставим", () => {
  assert.deepEqual(tagPlan({ tag: "1.2.0", existsOnForge: false }), { push: true })
})

test("B2 tagPlan: no-bump (tag=null) → ничего не ставим, не STOP", () => {
  const r = tagPlan({ tag: null, existsOnForge: false })
  assert.equal(r.stop, undefined)
  assert.equal(r.push, false)
})

// ── B3 · археология релиза — тело self-sufficient ─────────────────────────────────
test("B3 releaseNotes: причина бампа + ссылка на PR", () => {
  const n = releaseNotes({ tag: "1.2.0", reason: "patch bump", prUrl: "https://…/pull/7" })
  assert.match(n, /1\.2\.0/); assert.match(n, /patch bump/); assert.match(n, /pull\/7/)
})

// ── B4 · снятие долга при закрытии ────────────────────────────────────────────────
test("B4 debtToRemove: маркер resolves-debt + мерж → путь /debt/task-NNN.md", () => {
  assert.equal(debtToRemove({ resolvesDebt: "task-042", merged: true }), "debt/task-042.md")
})

test("B4 debtToRemove: без маркера → долги не трогаем (null)", () => {
  assert.equal(debtToRemove({ resolvesDebt: "", merged: true }), null)
  assert.equal(debtToRemove({ merged: true }), null)
})

test("B4 debtToRemove: битый маркер → null (не гадаем путь)", () => {
  assert.equal(debtToRemove({ resolvesDebt: "task-x", merged: true }), null)
  assert.equal(debtToRemove({ resolvesDebt: "../etc/passwd", merged: true }), null)
})

test("B4 debtToRemove: мерж не подтверждён → долг цел даже с маркером", () => {
  assert.equal(debtToRemove({ resolvesDebt: "task-042", merged: false }), null)
})
