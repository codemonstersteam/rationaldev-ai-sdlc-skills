// Юнит-тесты anti-loop детектора (чисто, io: none). Ядро — enforcement/shared.mjs.
import { test } from "node:test"
import assert from "node:assert/strict"
import { toolCallSignature, detectLoop } from "../enforcement/shared.mjs"

// --- toolCallSignature ---
test("toolCallSignature: одинаковые args (разный порядок ключей) → одна сигнатура", () => {
  assert.equal(
    toolCallSignature("bash", { command: "go build", cwd: "." }),
    toolCallSignature("bash", { cwd: ".", command: "go build" }),
  )
})
test("toolCallSignature: разные args/tool → разные сигнатуры", () => {
  assert.notEqual(toolCallSignature("bash", { command: "go build" }), toolCallSignature("bash", { command: "go test" }))
  assert.notEqual(toolCallSignature("read", { path: "a" }), toolCallSignature("edit", { path: "a" }))
})

// --- detectLoop: K подряд одинаковых ---
const sig = (n) => `s${n}`
test("detectLoop: 5 подряд одинаковых → петля", () => {
  assert.ok(detectLoop(["a", "a", "a", "a", "a"]))
})
test("detectLoop: 4 одинаковых (< runThreshold 5) → нет петли", () => {
  assert.equal(detectLoop(["a", "a", "a", "a"]), null)
})
test("detectLoop: одинаковые с прогрессом между → нет петли", () => {
  assert.equal(detectLoop(["a", "a", "b", "a", "a"]), null)
})
test("detectLoop: разнообразные вызовы → нет петли", () => {
  assert.equal(detectLoop(["a", "b", "c", "d", "e", "f"]), null)
})

// --- detectLoop: короткий цикл (read↔edit-петля) ---
test("detectLoop: цикл период-2 повторён 3 раза (A,B×3) → петля", () => {
  assert.ok(detectLoop(["x", "A", "B", "A", "B", "A", "B"]))
})
test("detectLoop: цикл период-2 повторён 2 раза (< cycleRepeats 3) → нет петли", () => {
  assert.equal(detectLoop(["A", "B", "A", "B"]), null)
})
test("detectLoop: цикл период-3 повторён 3 раза → петля", () => {
  assert.ok(detectLoop(["A", "B", "C", "A", "B", "C", "A", "B", "C"]))
})

// --- пороги настраиваемы ---
test("detectLoop: runThreshold=3 → ловит 3 подряд", () => {
  assert.ok(detectLoop(["a", "a", "a"], { runThreshold: 3 }))
  assert.equal(detectLoop(["a", "a"], { runThreshold: 3 }), null)
})
test("detectLoop: реальный сценарий — hughes долбит go build без изменений", () => {
  const b = toolCallSignature("bash", { command: "go build ./..." })
  assert.ok(detectLoop([b, b, b, b, b]))
})
