// ledger.mjs — чистое ядро сборки журнала из git (io: none). Формула: 1 happy + Σ ветвей antecedent
// (слой-источник факта / форма мержа / отсутствие слоя). Git здесь не нужен: все входы — строки.
import { test } from "node:test"
import assert from "node:assert/strict"
import { trailersFrom, prNumberFrom, slugFromSubject, entryFrom, isRunEntry, renderMd } from "../ledger.mjs"
import { weightFrom } from "../../ci/semver-bump.mjs"

const MERGE_SUBJECT = "Merge pull request #8 from codemonstersteam/chore/report-canon-doc"
const BRANCH_MSG = `chore: канон report-format v1.1

Run: report-canon-doc
Weight: chore
BR: debt/01-report-canon-doc.md
Task: канон формата отчёта экосистемы v1.1`
const NOTE = `run: report-canon-doc
weight: chore
closed_at: 2026-07-25T13:52:14.523Z
tag: none
bump: no-bump
reason: weight='chore' не бампается`

test("happy: три слоя вместе → полная запись прогона", () => {
  const e = entryFrom({
    sha: "8637102", date: "2026-07-25T16:51:14+03:00", subject: MERGE_SUBJECT, body: "chore: add canon v1.1",
    trailers: trailersFrom(BRANCH_MSG), note: trailersFrom(NOTE),
  }, { weightFrom })
  assert.equal(e.pr, "8")
  assert.equal(e.run, "report-canon-doc")
  assert.equal(e.weight, "chore")
  assert.equal(e.br, "debt/01-report-canon-doc.md")
  assert.equal(e.task, "канон формата отчёта экосистемы v1.1")
  assert.equal(e.tag, null)                       // tag: none → тега нет, но исход ИЗВЕСТЕН
  assert.equal(e.bump, "no-bump")
  assert.equal(e.date, "2026-07-25T13:52:14.523Z") // closed_at из заметки главнее даты коммита
  assert.equal(isRunEntry(e), true)
})

test("трейлеры: последний выигрывает (amend дописывает футер ниже)", () => {
  assert.equal(trailersFrom("Weight: patch\nWeight: minor").weight, "minor")
  assert.deepEqual(trailersFrom("нет футера"), {})
  assert.equal(trailersFrom("Task: канон: формат v1.1").task, "канон: формат v1.1")  // двоеточие в значении
})

test("PR: мерж-коммит и squash-заголовок — два способа мержа форжа", () => {
  assert.equal(prNumberFrom(MERGE_SUBJECT), "8")
  assert.equal(prNumberFrom("chore: канон report-format v1.1 (#8)"), "8")
  assert.equal(prNumberFrom("feat: без PR"), null)
})

test("slug из subject мержа: владелец и тип-префикс ветки отброшены", () => {
  assert.equal(slugFromSubject(MERGE_SUBJECT), "report-canon-doc")
  assert.equal(slugFromSubject("Merge pull request #9 from org/hotfix"), "hotfix")   // ветка без префикса
  assert.equal(slugFromSubject("обычный коммит"), null)
})

test("вес: трейлер главнее Conventional-заголовка (заголовок правится при мерже)", () => {
  const e = entryFrom({ sha: "s", subject: MERGE_SUBJECT, body: "feat: выглядит как minor",
    trailers: { weight: "patch" } }, { weightFrom })
  assert.equal(e.weight, "patch")
})

test("без трейлеров (репо до перехода/чужой PR) → вес из заголовка PR в теле мержа", () => {
  const e = entryFrom({ sha: "s", subject: MERGE_SUBJECT, body: "feat: новая способность" }, { weightFrom })
  assert.equal(e.weight, "minor")
  assert.equal(e.run, "report-canon-doc")   // slug всё равно есть — из subject мержа
})

test("🔴 обычный коммит транка (не мерж, без трейлеров/заметки) — НЕ запись журнала", () => {
  const e = entryFrom({ sha: "s", subject: "feat(design): дизайн-пакет" }, { weightFrom })
  assert.equal(e.weight, "minor")           // вес-то распознан…
  assert.equal(isRunEntry(e), false)        // …но прогоном это не делает — иначе журнал = git log
})

test("рендер: нет заметки → исход тега неизвестен («—»), а не выдуманный no-bump", () => {
  const md = renderMd([entryFrom({ sha: "abc123def456", date: "T", subject: MERGE_SUBJECT }, { weightFrom })])
  assert.match(md, /- tag: —/)
  assert.doesNotMatch(md, /no-bump/)
})

test("рендер: заметка с no-bump → печатается причина", () => {
  const md = renderMd([entryFrom({ sha: "s", date: "T", subject: MERGE_SUBJECT, note: trailersFrom(NOTE) }, { weightFrom })])
  assert.match(md, /- tag: no-bump: weight='chore'/)
})

test("пустой журнал — штатный исход, а не сбой", () => {
  assert.match(renderMd([]), /записей нет/)
})
