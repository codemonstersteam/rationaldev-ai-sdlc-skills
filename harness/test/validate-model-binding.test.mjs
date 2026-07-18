// Юнит-тесты ядра валидатора связки тир/роль→модель→провайдер (io: none).
import { test } from "node:test"
import assert from "node:assert/strict"
import { validateModelBinding } from "../lib/validate-model-binding.mjs"

const custom = (id, models) => ({ provider: { [id]: { options: { baseURL: "http://x" }, models } } })

test("happy: кастомный провайдер с объявленной моделью+лимитами → ok", () => {
  const runner = { tiers: { large: "llm-platform/frontier", small: "llm-platform/flash" } }
  const global = custom("llm-platform", { frontier: { limit: { context: 250144, output: 8192 } }, flash: { limit: { context: 128000, output: 4096 } } })
  assert.deepEqual(validateModelBinding(runner, global), { ok: true, missing: [] })
})

test("🔴 провайдер не найден (openrouter при llm-platform) → ✗ с reason", () => {
  const runner = { tiers: { large: "openrouter/z-ai/glm-5.2" } }
  const global = custom("llm-platform", { frontier: { limit: { context: 1, output: 1 } } })
  const r = validateModelBinding(runner, global)
  assert.equal(r.ok, false)
  assert.equal(r.missing.length, 1)
  assert.match(r.missing[0].reason, /провайдер 'openrouter' не найден/)
  assert.equal(r.missing[0].role, "tier:large")
})

test("кастомный провайдер, модель НЕ объявлена → ✗", () => {
  const runner = { tiers: { large: "llm-platform/unknown-model" } }
  const global = custom("llm-platform", { frontier: { limit: { context: 1, output: 1 } } })
  const r = validateModelBinding(runner, global)
  assert.equal(r.ok, false)
  assert.match(r.missing[0].reason, /не объявлена у кастомного провайдера/)
})

test("registry-провайдер (нет baseURL) без models — НЕ ложно-срабатывает", () => {
  const runner = { tiers: { large: "openrouter/z-ai/glm-5.2" } }
  const global = { provider: { openrouter: { options: { apiKey: "k" } } } }   // нет baseURL → registry
  assert.equal(validateModelBinding(runner, global).ok, true)
})

test("объявленная модель без лимитов → ✗", () => {
  const runner = { tiers: { large: "llm-platform/frontier" } }
  const global = custom("llm-platform", { frontier: { name: "F" } })   // нет limit
  const r = validateModelBinding(runner, global)
  assert.equal(r.ok, false)
  assert.match(r.missing[0].reason, /нет limit\.context/)
})

test("нет провайдер-префикса → ✗", () => {
  const r = validateModelBinding({ tiers: { large: "glm-5.2" } }, { provider: {} })
  assert.equal(r.ok, false)
  assert.match(r.missing[0].reason, /нет провайдер-префикса/)
})

test("роли валидируются наравне с тирами", () => {
  const runner = { tiers: { large: "llm-platform/frontier" }, roles: { izi: "openrouter/glm" } }
  const global = custom("llm-platform", { frontier: { limit: { context: 1, output: 1 } } })
  const r = validateModelBinding(runner, global)
  assert.equal(r.ok, false)
  assert.ok(r.missing.some((m) => m.role === "role:izi" && /openrouter/.test(m.model)))
})

test("пустой/отсутствующий global provider → все ссылки висячие", () => {
  const r = validateModelBinding({ tiers: { large: "llm-platform/frontier" } }, {})
  assert.equal(r.ok, false)
  assert.match(r.missing[0].reason, /не найден/)
})
