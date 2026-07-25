// Юнит-тесты leaf-функции answerTextFromEvent (io: none) — извлечение текста выбора оператора из нативного
// меню opencode (event question.replied), чтобы Gate #1 акцептовался И из терминального меню, не только печатью
// токена в чат. Формула: 1 happy + Σ ветвей antecedent (типы события / форма payload / форма answers).
import { test } from "node:test"
import assert from "node:assert/strict"
import { answerTextFromEvent, answerTextFromToolResponse, isOperatorApproval, isGate2Approval } from "../enforcement/shared.mjs"

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

// ── Claude Code: меню — это ТУЛ AskUserQuestion, выбор приходит в PostToolUse.tool_response ──────
// Формула: 1 happy + Σ ветвей (форма answers / анти-спуф / строковый конверт / мусор).

test("happy: tool_response.answers {вопрос: выбор} → лейбл выбранной опции", () => {
  const resp = { answers: { "Акцептуешь план slice-auth?": "GATE1 APPROVE" }, questions: [], annotations: {} }
  assert.equal(answerTextFromToolResponse(resp), "GATE1 APPROVE")
  assert.equal(isOperatorApproval(answerTextFromToolResponse(resp)), true)
})

test("несколько вопросов / multiSelect (массив значений) → всё склеено", () => {
  const resp = { answers: { "Срез?": ["slice-auth"], "Акцепт?": "GATE1 APPROVE" } }
  assert.equal(answerTextFromToolResponse(resp), "slice-auth GATE1 APPROVE")
  assert.equal(isOperatorApproval(answerTextFromToolResponse(resp)), true)
})

test("🔴 анти-спуф: токен в ТЕКСТЕ ВОПРОСА (ключ), выбран Reject → НЕ акцепт", () => {
  const resp = { answers: { "Напечатать GATE1 APPROVE или вернуть на доработку?": "Reject" } }
  assert.equal(answerTextFromToolResponse(resp), "Reject")
  assert.equal(isOperatorApproval(answerTextFromToolResponse(resp)), false)
})

test("деградация: tool_response строкой-конвертом → берутся ПРАВЫЕ части пар", () => {
  const s = 'Your questions have been answered: "Акцептуешь план?"="GATE1 APPROVE". You can now continue.'
  assert.equal(answerTextFromToolResponse(s), "GATE1 APPROVE")
  // и там же анти-спуф: токен слева (в вопросе), справа отказ
  const spoof = 'Your questions have been answered: "GATE1 APPROVE?"="Reject".'
  assert.equal(isOperatorApproval(answerTextFromToolResponse(spoof)), false)
})

test("Gate #2 тем же каналом: выбор «GATE2 APPROVE» → акцепт мержа", () => {
  const resp = { answers: { "Мержим PR #42?": "GATE2 APPROVE" } }
  assert.equal(isGate2Approval(answerTextFromToolResponse(resp)), true)
})

test("невалидный вход (null / нет answers / не-строки) → '' без исключения", () => {
  assert.equal(answerTextFromToolResponse(null), "")
  assert.equal(answerTextFromToolResponse(undefined), "")
  assert.equal(answerTextFromToolResponse({}), "")
  assert.equal(answerTextFromToolResponse({ answers: { q: 1 } }), "")
})
