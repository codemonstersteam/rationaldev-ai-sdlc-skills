// Юнит-тесты leaf-функции answerTextFromEvent (io: none) — извлечение текста выбора оператора из нативного
// меню opencode (event question.replied), чтобы Gate #1 акцептовался И из терминального меню, не только печатью
// токена в чат. Формула: 1 happy + Σ ветвей antecedent (типы события / форма payload / форма answers).
import { test } from "node:test"
import assert from "node:assert/strict"
import { answerTextFromEvent, isOperatorApproval } from "../enforcement/shared.mjs"

test("happy: question.replied (data.answers) → лейбл выбранной опции", () => {
  const ev = { type: "question.replied", data: { answers: [["GATE1 APPROVE"]] } }
  assert.equal(answerTextFromEvent(ev), "GATE1 APPROVE")
  assert.equal(isOperatorApproval(answerTextFromEvent(ev)), true)   // сквозь → акцепт
})

test("payload-ключ properties (v1-обёртка события) → извлекается наравне с data", () => {
  const ev = { type: "question.replied", properties: { answers: [["GATE1 APPROVE"]] } }
  assert.equal(answerTextFromEvent(ev), "GATE1 APPROVE")
})

test("вложенные/множественные answers → плоско склеены (токен всё равно ловится)", () => {
  const ev = { type: "question.replied", data: { answers: [["slice-auth"], ["GATE1 APPROVE"]] } }
  assert.equal(answerTextFromEvent(ev), "slice-auth GATE1 APPROVE")
  assert.equal(isOperatorApproval(answerTextFromEvent(ev)), true)
})

test("выбор НЕ-акцепт-пункта (Reject) → текст есть, но токена нет → не акцепт", () => {
  const ev = { type: "question.replied", data: { answers: [["Reject / вернуть на доработку"]] } }
  assert.equal(isOperatorApproval(answerTextFromEvent(ev)), false)
})

test("🔴 не-question событие (session.error) → '' (не путать каналы)", () => {
  assert.equal(answerTextFromEvent({ type: "session.error", properties: { answers: [["GATE1 APPROVE"]] } }), "")
})

test("question.v2.replied (v2-вариант типа) → тоже ловится (includes question+replied)", () => {
  const ev = { type: "question.v2.replied", data: { answers: [["GATE1 APPROVE"]] } }
  assert.equal(answerTextFromEvent(ev), "GATE1 APPROVE")
})

test("невалидный вход (null / нет answers / не-строки) → '' без исключения", () => {
  assert.equal(answerTextFromEvent(null), "")
  assert.equal(answerTextFromEvent(undefined), "")
  assert.equal(answerTextFromEvent({ type: "question.replied" }), "")
  assert.equal(answerTextFromEvent({ type: "question.replied", data: { answers: [[1, null, { x: 1 }]] } }), "")
})

test("защитно: answers как голая строка (иная форма payload по версии SDK) — тоже извлекается", () => {
  assert.equal(answerTextFromEvent({ type: "question.replied", data: { answers: "GATE1 APPROVE" } }), "GATE1 APPROVE")
})
