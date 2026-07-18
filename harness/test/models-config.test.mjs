// T5: merge локального models-override поверх клон-дефолта (клон pristine).
import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { mergeModelsConfig, loadModelsConfig } from "../lib/models-config.mjs"

test("mergeModelsConfig: override выигрывает на листьях, объекты сливаются", () => {
  const base = { opencode: { tiers: { large: "GLM", medium: "Qwen", small: "Qwen" } }, watchdog: { chunkTimeout: 90000 } }
  const ov = { opencode: { tiers: { large: "GLM-5.2" } } }
  const m = mergeModelsConfig(base, ov)
  assert.equal(m.opencode.tiers.large, "GLM-5.2")   // override
  assert.equal(m.opencode.tiers.medium, "Qwen")     // сохранено из base
  assert.equal(m.watchdog.chunkTimeout, 90000)      // не тронуто
})

test("mergeModelsConfig: массивы/скаляры заменяются целиком", () => {
  assert.deepEqual(mergeModelsConfig({ a: [1, 2] }, { a: [3] }), { a: [3] })
  assert.equal(mergeModelsConfig({ a: 1 }, { a: 2 }).a, 2)
})

test("mergeModelsConfig: пустой/невалидный override → base без изменений", () => {
  const base = { x: 1 }
  assert.equal(mergeModelsConfig(base, null), base)
  assert.equal(mergeModelsConfig(base, [1]), base)
})

test("loadModelsConfig: без override → клон-дефолт как есть", () => {
  const root = mkdtempSync(join(tmpdir(), "mc-"))
  try {
    writeFileSync(join(root, "models.config.json"), JSON.stringify({ claude: { tiers: { large: "opus" } } }))
    const c = loadModelsConfig(root, undefined)
    assert.equal(c.claude.tiers.large, "opus")
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("loadModelsConfig: override ВНЕ клона переопределяет тир, клон не читается на запись", () => {
  const root = mkdtempSync(join(tmpdir(), "mc-"))
  try {
    writeFileSync(join(root, "models.config.json"), JSON.stringify({ opencode: { tiers: { large: "opus", small: "haiku" } } }))
    const ovPath = join(root, "..", `ov-${Date.now ? "x" : "x"}.json`)
    writeFileSync(ovPath, JSON.stringify({ opencode: { tiers: { large: "GLM-5.2" } } }))
    const c = loadModelsConfig(root, ovPath)
    assert.equal(c.opencode.tiers.large, "GLM-5.2")  // override
    assert.equal(c.opencode.tiers.small, "haiku")    // из клона
    rmSync(ovPath, { force: true })
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("loadModelsConfig: битый override → тихо клон-дефолт", () => {
  const root = mkdtempSync(join(tmpdir(), "mc-"))
  try {
    writeFileSync(join(root, "models.config.json"), JSON.stringify({ a: 1 }))
    const ovPath = join(root, "bad.json"); writeFileSync(ovPath, "{ not json")
    assert.deepEqual(loadModelsConfig(root, ovPath), { a: 1 })
  } finally { rmSync(root, { recursive: true, force: true }) }
})
