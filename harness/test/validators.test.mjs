// Юнит-тесты чистых ядер валидаторов (io: none). Формула: 1 happy + по ветке-blocker.
import { test } from "node:test"
import assert from "node:assert/strict"
import { validateFrd, validateContractFrozen, validateTicketHeaders } from "../lib/validators.mjs"

// --- validateFrd ---
const FRD_OK = `# svc — FRD
## Problem statement
одна фраза
## Actors & external systems
| client | HTTP |
## Use cases
### UC1
Extensions: 1a ошибка
## Contract (draft)
openapi skeleton
## Failure-mode map
| STORE_MISSING | 500 |
## NFR
## Open questions
`
test("validateFrd: полный FRD → нет ошибок", () => {
  assert.deepEqual(validateFrd(FRD_OK), [])
})
test("validateFrd: нет акторов → ошибка", () => {
  const errs = validateFrd(FRD_OK.replace(/## Actors & external systems[\s\S]*?## Use cases/, "## Use cases"))
  assert.ok(errs.some((e) => /actors/i.test(e)))
})
test("validateFrd: нет Extensions → ошибка", () => {
  const errs = validateFrd(FRD_OK.replace(/Extensions: 1a ошибка/, "просто шаги"))
  assert.ok(errs.some((e) => /Extensions/i.test(e)))
})

// --- validateContractFrozen ---
const OAS_OK = `openapi: 3.1.0
info:
  x-frozen: true
paths:
  /services:
    get:
      responses:
        '200':
          content: {}
components:
  schemas:
    Error: {}
`
test("validateContractFrozen: полный + x-frozen → нет ошибок", () => {
  assert.deepEqual(validateContractFrozen(OAS_OK), [])
})
test("validateContractFrozen: нет x-frozen → ошибка заморозки", () => {
  assert.ok(validateContractFrozen(OAS_OK.replace(/\s*x-frozen: true/, "")).some((e) => /x-frozen/.test(e)))
})
test("validateContractFrozen: пустой paths → ошибка", () => {
  const bad = "openapi: 3.1.0\ninfo:\n  x-frozen: true\npaths:\nresponses: {}\ncomponents:\n  schemas: {}\n"
  assert.ok(validateContractFrozen(bad).some((e) => /paths/.test(e)))
})
test("validateContractFrozen: AsyncAPI вариант", () => {
  const asyncOk = "asyncapi: 2.6.0\nx-frozen: true\nchannels:\n  evt: {}\ncomponents:\n  messages: {}\n"
  assert.deepEqual(validateContractFrozen(asyncOk), [])
})

// --- validateTicketHeaders (чисто, без fs) ---
const T = (over = {}) => ({ name: over.name ?? "05-mod.md", data: over.data === null ? null : { id: "05", type: "module", slice: "s1", blocked_by: ["01"], inputs: ["x"], io: "none", skills: [], ...over.data } })
const SCAFFOLD = { name: "01-scaffold.md", data: { id: "01", type: "scaffold", slice: "s1", blocked_by: [], inputs: [], skills: [] } }

test("validateTicketHeaders: scaffold + module → нет ошибок", () => {
  assert.deepEqual(validateTicketHeaders([SCAFFOLD, T()]), [])
})
test("validateTicketHeaders: нет заголовка → ошибка", () => {
  assert.ok(validateTicketHeaders([SCAFFOLD, T({ name: "x.md", data: null })]).some((e) => /нет YAML-заголовка/.test(e)))
})
test("validateTicketHeaders: битый type → ошибка", () => {
  assert.ok(validateTicketHeaders([SCAFFOLD, T({ data: { type: "bogus" } })]).some((e) => /type=/.test(e)))
})
test("validateTicketHeaders: module без io → ошибка", () => {
  assert.ok(validateTicketHeaders([SCAFFOLD, T({ data: { io: undefined } })]).some((e) => /без валидного io/.test(e)))
})
test("validateTicketHeaders: blocked_by в никуда → ошибка", () => {
  assert.ok(validateTicketHeaders([SCAFFOLD, T({ data: { blocked_by: ["99"] } })]).some((e) => /несуществующий тикет/.test(e)))
})
test("validateTicketHeaders: два scaffold → ошибка", () => {
  assert.ok(validateTicketHeaders([SCAFFOLD, { ...SCAFFOLD, name: "02-scaffold.md" }]).some((e) => /ровно ОДИН scaffold/.test(e)))
})
test("validateTicketHeaders: normId 05 == 5 (blocked_by резолвится)", () => {
  const child = T({ data: { blocked_by: ["1"] } })
  const s = { name: "01.md", data: { id: "01", type: "scaffold", slice: "s", blocked_by: [], inputs: [], skills: [] } }
  assert.deepEqual(validateTicketHeaders([s, child]), [])
})
