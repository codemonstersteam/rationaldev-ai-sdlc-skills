// Юнит-тесты чистого резолвинга модели/температуры (io: none). roles > tiers > null.
import { test } from "node:test"
import assert from "node:assert/strict"
import { resolveModel, resolveTemp } from "../lib/resolve-model.mjs"

const CFG = {
  opencode: {
    tiers: { large: "GLM", medium: "QWEN", small: "QWEN" },
    roles: { izi: "QWEN-OVR" },
    temperature: { large: 0.3, roles: { izi: 0.1 } },
  },
  codex: { tiers: { large: "", medium: "", small: "" }, roles: {} },
}

test("resolveModel: пер-ролевой оверрайд важнее тира", () => {
  assert.equal(resolveModel(CFG, "opencode", "izi", "large"), "QWEN-OVR")
})
test("resolveModel: без оверрайда → модель тира", () => {
  assert.equal(resolveModel(CFG, "opencode", "mills", "large"), "GLM")
})
test("resolveModel: пустой тир → null (наследуется)", () => {
  assert.equal(resolveModel(CFG, "codex", "izi", "large"), null)
})
test("resolveModel: неизвестный раннер → null", () => {
  assert.equal(resolveModel(CFG, "nope", "izi", "large"), null)
})

test("resolveTemp: пер-ролевая температура важнее тира", () => {
  assert.equal(resolveTemp(CFG, "opencode", "izi", "large"), 0.1)
})
test("resolveTemp: без ролевой → температура тира", () => {
  assert.equal(resolveTemp(CFG, "opencode", "mills", "large"), 0.3)
})
test("resolveTemp: нет секции temperature → null", () => {
  assert.equal(resolveTemp(CFG, "codex", "izi", "large"), null)
})
