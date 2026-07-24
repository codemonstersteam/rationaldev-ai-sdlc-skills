// Diff-gate эволюции контракта: ОДНО поведение (breaking→exit 2, аддитивно→0; инструмент не знает про
// веса). Классификация breaking (contractDiff) + verdict + диспетчер по формату (detectFormat +
// dispatchContract, встроенный JSON-дифф + мок наличия/отсутствия отраслевого бинаря) + fail-closed +
// сквозной прогон CLI на временном git-репо (нет базы → не блокирует; openapi.yaml без oasdiff → STOP).
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync, execSync } from "node:child_process"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { contractDiff, verdict, detectFormat, dispatchContract, binaryInPath, FORMAT_TOOL } from "../validate-contract-diff.mjs"

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

// --- verdict: ОДНО поведение -------------------------------------------------------------------
test("verdict: аддитивно → exit 0", () => {
  assert.equal(verdict([]).code, 0)
  assert.match(verdict([]).lines[0], /нет breaking/)
})
test("verdict: breaking → exit 2 + список классов + объяснение разрешения по весу в конвейере", () => {
  const v = verdict([{ code: "NEW_REQUIRED", path: "/a" }], { rel: "openapi.json" })
  assert.equal(v.code, 2)
  assert.match(v.lines[0], /BREAKING/)
  assert.match(v.lines[0], /major/)
  assert.ok(v.lines.some((l) => /NEW_REQUIRED @ \/a/.test(l)))
})

// --- detectFormat: маршрутизация по формату спеки ----------------------------------------------
test("detectFormat: openapi (по полю openapi:, .yaml и .json) → openapi", () => {
  assert.equal(detectFormat("api-specification/openapi.yaml", "openapi: 3.0.0\npaths: {}\n"), "openapi")
  assert.equal(detectFormat("openapi.json", '{"openapi":"3.0.0","paths":{}}'), "openapi")
})
test("detectFormat: asyncapi (по полю asyncapi:) → asyncapi", () => {
  assert.equal(detectFormat("asyncapi.yaml", "asyncapi: 2.6.0\nchannels: {}\n"), "asyncapi")
})
test("detectFormat: .json без маркера openapi/asyncapi → jsonschema", () => {
  assert.equal(detectFormat("config.schema.json", '{"$schema":"...","properties":{"a":{}}}'), "jsonschema")
})
test("detectFormat: YAML без маркера → unknown (нет распознанного формата)", () => {
  assert.equal(detectFormat("random.yaml", "foo: bar\n"), "unknown")
})

// --- dispatchContract: встроенный JSON-дифф классифицирует -------------------------------------
test("dispatch(jsonschema): аддитивно → 0", () => {
  const r = dispatchContract({ rel: "config.schema.json", format: "jsonschema",
    prevText: '{"properties":{"a":{}}}', nextText: '{"properties":{"a":{},"b":{}}}' })
  assert.equal(r.code, 0)
})
test("dispatch(jsonschema): breaking (тип сменился) → 2", () => {
  const r = dispatchContract({ rel: "config.schema.json", format: "jsonschema",
    prevText: '{"properties":{"a":{"type":"integer"}}}', nextText: '{"properties":{"a":{"type":"string"}}}' })
  assert.equal(r.code, 2)
  assert.ok(r.lines.some((l) => /TYPE_CHANGED/.test(l)))
})
test("dispatch(jsonschema): нераспарсиваемый JSON → fail-closed STOP 2", () => {
  const r = dispatchContract({ rel: "config.schema.json", format: "jsonschema", prevText: "{not json", nextText: "{}" })
  assert.equal(r.code, 2)
  assert.ok(r.failClosed)
  assert.match(r.lines[0], /fail-closed/)
})

// --- dispatchContract: отраслевой тул — мок наличия/отсутствия бинаря ---------------------------
test("dispatch(openapi): бинаря НЕТ в PATH → fail-closed STOP 2 + команда установки", () => {
  const r = dispatchContract({ rel: "api-specification/openapi.yaml", format: "openapi", prevText: "a", nextText: "b" },
    { hasBinary: () => false })
  assert.equal(r.code, 2)
  assert.ok(r.failClosed)
  assert.match(r.lines[0], /oasdiff/)
  assert.match(r.lines[0], new RegExp(FORMAT_TOOL.openapi.install.split(" ")[0])) // «brew …»
})
test("dispatch(openapi): бинарь есть, тул сообщил breaking → 2 + строки тула", () => {
  const r = dispatchContract({ rel: "openapi.yaml", format: "openapi", prevText: "a", nextText: "b" },
    { hasBinary: () => true, runExternal: () => ({ breaking: true, lines: ["removed endpoint GET /x"] }) })
  assert.equal(r.code, 2)
  assert.ok(r.lines.some((l) => /removed endpoint GET \/x/.test(l)))
})
test("dispatch(openapi): бинарь есть, тул сообщил аддитивно → 0", () => {
  const r = dispatchContract({ rel: "openapi.yaml", format: "openapi", prevText: "a", nextText: "b" },
    { hasBinary: () => true, runExternal: () => ({ breaking: false, lines: [] }) })
  assert.equal(r.code, 0)
})
test("dispatch(openapi): бинарь есть, но запуск тула упал → fail-closed STOP 2", () => {
  const r = dispatchContract({ rel: "openapi.yaml", format: "openapi", prevText: "a", nextText: "b" },
    { hasBinary: () => true, runExternal: () => { throw new Error("boom") } })
  assert.equal(r.code, 2)
  assert.ok(r.failClosed)
})
test("dispatch(asyncapi): бинаря нет → fail-closed с asyncapi-командой установки", () => {
  const r = dispatchContract({ rel: "asyncapi.yaml", format: "asyncapi", prevText: "a", nextText: "b" },
    { hasBinary: () => false })
  assert.equal(r.code, 2)
  assert.match(r.lines[0], /asyncapi/)
})
test("dispatch(unknown): формат не распознан → не блокирует (0, skip)", () => {
  const r = dispatchContract({ rel: "random.yaml", format: "unknown", prevText: "a", nextText: "b" })
  assert.equal(r.code, 0)
  assert.ok(r.skip)
})

// --- сквозной прогон CLI на временном git-репо ---------------------------------------------------
const repoWith = (base, head, name = "openapi.json") => {
  const dir = mkdtempSync(join(tmpdir(), "contract-diff-"))
  execSync("git init -q && git config user.email t@t && git config user.name t", { cwd: dir })
  mkdirSync(join(dir, "api-specification"))
  const file = join(dir, "api-specification", name)
  const ser = (x) => typeof x === "string" ? x : JSON.stringify(x)
  if (base != null) {
    writeFileSync(file, ser(base))
    execSync("git add -A && git commit -qm base", { cwd: dir })
  }
  writeFileSync(file, ser(head))
  return dir
}
const run = (dir, args = []) => {
  try { return { code: 0, out: execFileSync(process.execPath, [CLI, ...args], { cwd: dir, encoding: "utf8" }) } }
  catch (e) { return { code: e.status, out: String(e.stdout) } }
}

test("CLI: аддитивная эволюция JSON-Schema → 0", () => {
  const dir = repoWith({ properties: { a: {} } }, { properties: { a: {}, b: {} } })
  const r = run(dir)
  assert.equal(r.code, 0)
  assert.match(r.out, /нет breaking/)
  rmSync(dir, { recursive: true, force: true })
})
test("CLI: breaking JSON-Schema → 2 (одно поведение, без флагов)", () => {
  const dir = repoWith({ properties: { a: { type: "integer" } } }, { properties: { a: { type: "string" } } })
  assert.equal(run(dir).code, 2)
  assert.match(run(dir).out, /BREAKING/)
  rmSync(dir, { recursive: true, force: true })
})
test("CLI: нет базы в HEAD → не оценимо, 0 (аддитивность доказывает @fagan)", () => {
  const dir = repoWith(null, { properties: { a: {} } })
  execSync("git commit -qm empty --allow-empty", { cwd: dir })
  const r = run(dir)
  assert.equal(r.code, 0)
  assert.match(r.out, /нет базы/)
  rmSync(dir, { recursive: true, force: true })
})
test("CLI: OpenAPI-спека (openapi.yaml) без установленного oasdiff → fail-closed STOP 2",
  { skip: binaryInPath("oasdiff") ? "oasdiff установлен — реальный дифф вместо fail-closed" : false }, () => {
    const dir = repoWith("openapi: 3.0.0\npaths:\n  /x:\n    get: {}\n",
                         "openapi: 3.0.0\npaths:\n  /y:\n    get: {}\n", "openapi.yaml")
    const r = run(dir)
    assert.equal(r.code, 2)
    assert.match(r.out, /fail-closed/)
    assert.match(r.out, /oasdiff/)
    rmSync(dir, { recursive: true, force: true })
  })
