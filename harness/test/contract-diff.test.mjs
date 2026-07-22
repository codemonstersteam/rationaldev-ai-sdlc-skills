// Diff-gate эволюции контракта: классификация breaking vs additive (contractDiff) + код возврата
// (verdict: minor --require-additive = 2, major advisory = 0) + сквозной прогон CLI на временном git-репо,
// включая «неоценимый» случай (нет базы в HEAD) — он не блокирует даже с флагом.
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync, execSync } from "node:child_process"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { contractDiff, verdict } from "../validate-contract-diff.mjs"

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "validate-contract-diff.mjs")

// --- классификация: breaking vs additive -------------------------------------------------------
test("contractDiff: аддитивное — новое НЕобязательное поле / новая операция → не breaking", () => {
  assert.deepEqual(contractDiff({ properties: { a: {} } }, { properties: { a: {}, b: { type: "string" } } }), [])
  assert.deepEqual(contractDiff({ paths: { "/x": {} } }, { paths: { "/x": {}, "/y": {} } }), [])
})
test("contractDiff: breaking-классы — REMOVED · TYPE_CHANGED · NEW_REQUIRED · REMOVED_OP", () => {
  const codes = (p, n) => contractDiff(p, n).map((b) => b.code)
  assert.ok(codes({ properties: { a: {}, b: {} } }, { properties: { a: {} } }).includes("REMOVED"))
  assert.ok(codes({ properties: { a: { type: "integer" } } }, { properties: { a: { type: "string" } } }).includes("TYPE_CHANGED"))
  assert.ok(codes({ properties: { a: {} }, required: [] }, { properties: { a: {} }, required: ["a"] }).includes("NEW_REQUIRED"))
  assert.ok(codes({ paths: { "/x": {} } }, { paths: {} }).includes("REMOVED_OP"))
})
test("contractDiff: рекурсия по вложенным properties — путь ведёт к сломанному узлу", () => {
  const b = contractDiff({ properties: { o: { properties: { a: { type: "integer" } } } } },
                         { properties: { o: { properties: { a: { type: "string" } } } } })
  assert.equal(b.length, 1)
  assert.match(b[0].path, /\/o\/a/)
})

// --- код возврата -------------------------------------------------------------------------------
test("verdict: аддитивно → 0 в обоих режимах", () => {
  assert.equal(verdict([], { requireAdditive: false }).code, 0)
  assert.equal(verdict([], { requireAdditive: true }).code, 0)
})
test("verdict: breaking без флага (major) → advisory, exit 0", () => {
  const v = verdict([{ code: "REMOVED", path: "/a" }], { requireAdditive: false })
  assert.equal(v.code, 0)
  assert.match(v.lines[0], /BREAKING/)
})
test("verdict: breaking с --require-additive (minor) → exit 2 + внятный STOP про ре-триаж как major", () => {
  const v = verdict([{ code: "NEW_REQUIRED", path: "/a" }], { requireAdditive: true })
  assert.equal(v.code, 2)
  assert.match(v.lines[0], /^STOP:/)
  assert.match(v.lines[0], /major/)
})

// --- сквозной прогон CLI на временном git-репо ---------------------------------------------------
const repoWith = (base, head) => {
  const dir = mkdtempSync(join(tmpdir(), "contract-diff-"))
  execSync("git init -q && git config user.email t@t && git config user.name t", { cwd: dir })
  mkdirSync(join(dir, "api-specification"))
  const file = join(dir, "api-specification", "openapi.json")
  if (base) {
    writeFileSync(file, JSON.stringify(base))
    execSync("git add -A && git commit -qm base", { cwd: dir })
  }
  writeFileSync(file, JSON.stringify(head))
  return dir
}
const run = (dir, args = []) => {
  try { return { code: 0, out: execFileSync(process.execPath, [CLI, ...args], { cwd: dir, encoding: "utf8" }) } }
  catch (e) { return { code: e.status, out: String(e.stdout) } }
}

test("CLI: аддитивная эволюция → 0 с --require-additive", () => {
  const dir = repoWith({ properties: { a: {} } }, { properties: { a: {}, b: {} } })
  const r = run(dir, ["--require-additive"])
  assert.equal(r.code, 0)
  assert.match(r.out, /нет breaking/)
  rmSync(dir, { recursive: true, force: true })
})
test("CLI: breaking → 2 с --require-additive, 0 без флага (тот же репо)", () => {
  const dir = repoWith({ properties: { a: { type: "integer" } } }, { properties: { a: { type: "string" } } })
  const strict = run(dir, ["--require-additive"])
  assert.equal(strict.code, 2)
  assert.match(strict.out, /STOP/)
  assert.equal(run(dir).code, 0, "без флага поведение прежнее — advisory")
  rmSync(dir, { recursive: true, force: true })
})
test("CLI: нет базы в HEAD → не оценимо, 0 даже с флагом (аддитивность доказывает @fagan)", () => {
  const dir = repoWith(null, { properties: { a: {} } })
  execSync("git commit -qm empty --allow-empty", { cwd: dir })
  const r = run(dir, ["--require-additive"])
  assert.equal(r.code, 0)
  assert.match(r.out, /не доказуема|нет базы/)
  rmSync(dir, { recursive: true, force: true })
})
