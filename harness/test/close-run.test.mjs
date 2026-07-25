// close-run pure core: planClose (guards + tag delegation) · ledgerNote (постмерж-факты) ·
// wipeTargets (B1 инверсия) · tagPlan (B2) · releaseNotes (B3) · debtToRemove (B4).
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { planClose, ledgerNote, LEDGER_NOTES_REF, WIPE_KEEP, wipeTargets, tagPlan, releaseNotes, debtToRemove } from "../close-run.mjs"

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

test("ledgerNote: self-sufficient — task text inline, survives change-dir deletion", () => {
  const n = ledgerNote({ ts: "2026-01-01T00:00:00Z", slug: "fix-x", weight: "patch",
    pr: "https://…/pull/2", tag: "0.1.0", reason: "seed", task: "fix leaked set" })
  assert.match(n, /run: fix-x/); assert.match(n, /weight: patch/); assert.match(n, /tag: 0\.1\.0/)
  assert.match(n, /task: fix leaked set/, "task described in text, not by a link into the change-dir")
  assert.match(n, /bump: tagged/)
})

test("ledgerNote: no tag → records the no-bump reason, not an empty tag", () => {
  const n = ledgerNote({ ts: "t", slug: "s", weight: "chore", pr: "p", tag: null, reason: "plumbing" })
  assert.match(n, /tag: none/); assert.match(n, /bump: no-bump/); assert.match(n, /reason: plumbing/)
})

test("ledgerNote: форма `key: value` — её читает harness/ledger.mjs (общий контракт)", () => {
  const n = ledgerNote({ ts: "t", slug: "s", weight: "patch", pr: "p", tag: "v1.0.1", reason: "r", task: "t" })
  for (const line of n.split("\n").filter(Boolean)) assert.match(line, /^[a-z_]+: /, `строка не key: value → ${line}`)
  assert.equal(LEDGER_NOTES_REF, "ledger", "ref заметок — общий с ledger.mjs (--notes=ledger)")
})

test("ledgerNote: НЕ дублирует то, что уже несут мерж-коммит и трейлеры (merge-SHA)", () => {
  const n = ledgerNote({ ts: "t", slug: "s", weight: "patch", pr: "p", tag: null, reason: "r", task: "t" })
  assert.doesNotMatch(n, /merge:/, "merge-SHA — это сам анкер заметки, дублировать незачем")
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
test("B4 debtToRemove: маркер resolves-debt + мерж → тикет И его вендоренные ассеты", () => {
  assert.deepEqual(debtToRemove({ resolvesDebt: "task-042", merged: true }),
    ["debt/task-042.md", "debt/assets/task-042"],
    "ассеты (замороженный вход приёмки) — часть долга; иначе они остаются сиротами после оплаты")
})

test("B4 debtToRemove: без маркера → долги не трогаем (null)", () => {
  assert.deepEqual(debtToRemove({ resolvesDebt: "", merged: true }), [])
  assert.deepEqual(debtToRemove({ merged: true }), [])
})

test("B4 debtToRemove: битый маркер → null (не гадаем путь)", () => {
  assert.deepEqual(debtToRemove({ resolvesDebt: "task-x", merged: true }), [])
  assert.deepEqual(debtToRemove({ resolvesDebt: "../etc/passwd", merged: true }), [])
})

test("B4 debtToRemove: мерж не подтверждён → долг цел даже с маркером", () => {
  assert.deepEqual(debtToRemove({ resolvesDebt: "task-042", merged: false }), [])
})

// ── ACT 2 больше НЕ коммитит в транк: запись — заметка на merge-SHA ───────────────
// Регрессия прогона report-canon-doc: ledger-коммит делался с HEAD рабочей ветки, а транк уже уехал
// на мерж ⇒ push HEAD:trunk не fast-forward. Лишний коммит убран по конструкции — сторожим источник.
test("close-run: ACT 2 не коммитит и не пушит в транк (только refs/notes)", () => {
  const src = readFileSync(new URL("../close-run.mjs", import.meta.url), "utf8")
  assert.doesNotMatch(src, /HEAD:\$\{trunk\}/, "push HEAD:<trunk> вернул бы non-fast-forward после мержа")
  assert.doesNotMatch(src, /docs\/changes\/LEDGER\.md/, "файл-журнал упразднён — журнал собирается из git")
  assert.match(src, /"notes", "--ref", LEDGER_NOTES_REF, "add"/, "запись — git-заметка на merge-SHA")
  assert.match(src, /`refs\/notes\/\$\{LEDGER_NOTES_REF\}`/, "и её пуш отдельным ref")
})
