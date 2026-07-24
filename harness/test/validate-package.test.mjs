// Юнит-тесты чистого ядра validate-package (io: none) + сквозной CLI-тест (fs).
// Формула: 1 happy + по ветке-blocker (нет module-tree/CONTEXT/api-spec · непомеченная запись · mix as-is/gap).
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import {
  PROVENANCE_RE, SLICE_REQUIRED, checkPackageCompleteness, findUnmarkedEntries, validatePackage,
} from "../validate-package.mjs"

// --- PROVENANCE_RE (единый формат маркера) ---
test("PROVENANCE_RE: [as-is] / [gap] / [gap: …] матчатся, произвольная скобка — нет", () => {
  assert.ok(PROVENANCE_RE.test("- head → orchestrator [as-is]"))
  assert.ok(PROVENANCE_RE.test("- io [gap]"))
  assert.ok(PROVENANCE_RE.test("- io [gap: реальный стор S3, не Postgres]"))
  assert.equal(PROVENANCE_RE.test("- [Ordering](./x) — ссылка, не маркер"), false)
})

// --- checkPackageCompleteness (чисто) ---
const FULL_STRUCT = {
  slices: [{ slug: "foo", files: [...SLICE_REQUIRED] }],
  hasContext: true,
  hasContextMap: false,
  contextCount: 1,
  apiSpecFiles: ["openapi.yaml"],
}
test("checkPackageCompleteness: полный пакет → нет ошибок", () => {
  assert.deepEqual(checkPackageCompleteness(FULL_STRUCT), [])
})
test("checkPackageCompleteness: нет ни одного среза → blocker", () => {
  assert.ok(checkPackageCompleteness({ ...FULL_STRUCT, slices: [] }).some((e) => /нет ни одного docs\/design\/slice/.test(e)))
})
test("checkPackageCompleteness: срез без module-tree → blocker", () => {
  const s = { ...FULL_STRUCT, slices: [{ slug: "foo", files: ["contracts.md", "c4.md"] }] }
  assert.ok(checkPackageCompleteness(s).some((e) => /slice-foo.*нет module-tree\.md/.test(e)))
})
test("checkPackageCompleteness: нет корневого CONTEXT.md → blocker", () => {
  assert.ok(checkPackageCompleteness({ ...FULL_STRUCT, hasContext: false }).some((e) => /нет корневого CONTEXT\.md/.test(e)))
})
test("checkPackageCompleteness: пустой api-specification → blocker", () => {
  assert.ok(checkPackageCompleteness({ ...FULL_STRUCT, apiSpecFiles: [] }).some((e) => /api-specification\/ пуст/.test(e)))
})
test("checkPackageCompleteness: ≥2 CONTEXT.md без CONTEXT-MAP.md → blocker (мульти-контекст)", () => {
  const s = { ...FULL_STRUCT, contextCount: 2, hasContextMap: false }
  assert.ok(checkPackageCompleteness(s).some((e) => /мульти-контекст не сведён/.test(e)))
})
test("checkPackageCompleteness: ≥2 CONTEXT.md + CONTEXT-MAP.md есть → нет ошибки про карту", () => {
  const s = { ...FULL_STRUCT, contextCount: 2, hasContextMap: true }
  assert.deepEqual(checkPackageCompleteness(s), [])
})

// --- findUnmarkedEntries (чисто) ---
const MT_MARKED = `# Module tree — slice foo
- head → orchestrator [as-is]
- io → store adapter [gap: реальный стор S3, не Postgres как в контракте]
`
const CONTRACTS_MARKED = `# Contracts
| module | signature | provenance |
|---|---|---|
| head | Foo(x) -> Y | [as-is] |
| io   | Store(k) -> V | [gap: тайм-аут не задокументирован] |
`
test("findUnmarkedEntries: все записи (список + таблица) помечены → []", () => {
  assert.deepEqual(findUnmarkedEntries([{ path: "module-tree.md", content: MT_MARKED }]), [])
})
test("findUnmarkedEntries: mix as-is/gap → [] (оба маркера валидны)", () => {
  assert.deepEqual(findUnmarkedEntries([{ path: "contracts.md", content: CONTRACTS_MARKED }]), [])
})
test("findUnmarkedEntries: заголовок и разделитель таблицы НЕ требуют маркера", () => {
  // строки-заголовок `| module | … |` и разделитель `|---|` не помечены, но это не «записи»
  assert.deepEqual(findUnmarkedEntries([{ path: "contracts.md", content: CONTRACTS_MARKED }]), [])
})
test("findUnmarkedEntries: непомеченный элемент списка → сообщён с файлом:строкой", () => {
  const bad = "# MT\n- head [as-is]\n- io без метки\n"
  const u = findUnmarkedEntries([{ path: "module-tree.md", content: bad }])
  assert.equal(u.length, 1)
  assert.equal(u[0].path, "module-tree.md")
  assert.equal(u[0].line, 3)
  assert.match(u[0].text, /io без метки/)
})
test("findUnmarkedEntries: непомеченная строка-данные таблицы → сообщена", () => {
  const bad = "| m | sig |\n|---|---|\n| head | Foo [as-is] |\n| io | Bar |\n"
  const u = findUnmarkedEntries([{ path: "contracts.md", content: bad }])
  assert.equal(u.length, 1)
  assert.equal(u[0].line, 4)
})
test("findUnmarkedEntries: списки внутри ```-fence не считаются записями", () => {
  const md = "# C4\n\n```\n- это код, не запись\n```\n- реальная запись [as-is]\n"
  assert.deepEqual(findUnmarkedEntries([{ path: "c4.md", content: md }]), [])
})
test("findUnmarkedEntries: проза/заголовки — не записи (маркер не требуется)", () => {
  const md = "# Context\n\nОбычный абзац прозы без маркера.\n\n## Секция\n- запись [gap: TBD]\n"
  assert.deepEqual(findUnmarkedEntries([{ path: "CONTEXT.md", content: md }]), [])
})

// --- validatePackage (оркестрация) ---
test("validatePackage: полный размеченный пакет → нет ни completeness, ни unmarked", () => {
  const r = validatePackage(FULL_STRUCT, [{ path: "module-tree.md", content: MT_MARKED }])
  assert.deepEqual(r.completeness, [])
  assert.deepEqual(r.unmarked, [])
})

// --- CLI-хвост (сквозной, fs) ---
const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "validate-package.mjs")

// Собрать полный размеченный пакет в tmp-каталоге; mutate — колбэк для порчи фикстуры.
function makePackage(mutate) {
  const dir = mkdtempSync(join(tmpdir(), "validate-package-"))
  const slice = join(dir, "docs", "design", "slice-foo")
  mkdirSync(slice, { recursive: true })
  writeFileSync(join(slice, "module-tree.md"), MT_MARKED)
  writeFileSync(join(slice, "contracts.md"), CONTRACTS_MARKED)
  writeFileSync(join(slice, "c4.md"), "# C4\n- System boundary foo [as-is]\n")
  writeFileSync(join(dir, "CONTEXT.md"), "# Context\n- Bounded context: foo [as-is]\n")
  mkdirSync(join(dir, "api-specification"), { recursive: true })
  writeFileSync(join(dir, "api-specification", "openapi.yaml"), "openapi: 3.1.0\n")
  if (mutate) mutate(dir, slice)
  return dir
}
function run(dir) {
  try {
    const stdout = execFileSync(process.execPath, [CLI, dir], { encoding: "utf8" })
    return { status: 0, stdout, stderr: "" }
  } catch (e) {
    return { status: e.status, stdout: String(e.stdout || ""), stderr: String(e.stderr || "") }
  }
}

test("CLI: полный размеченный пакет → exit 0", () => {
  const dir = makePackage()
  const r = run(dir)
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /OK — пакет полон и размечен/)
  rmSync(dir, { recursive: true, force: true })
})
test("CLI: нет module-tree.md → exit 1 с перечислением", () => {
  const dir = makePackage((_d, slice) => rmSync(join(slice, "module-tree.md")))
  const r = run(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /нет module-tree\.md/)
  rmSync(dir, { recursive: true, force: true })
})
test("CLI: нет корневого CONTEXT.md → exit 1", () => {
  const dir = makePackage((d) => rmSync(join(d, "CONTEXT.md")))
  const r = run(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /нет корневого CONTEXT\.md/)
  rmSync(dir, { recursive: true, force: true })
})
test("CLI: пустой api-specification → exit 1", () => {
  const dir = makePackage((d) => rmSync(join(d, "api-specification", "openapi.yaml")))
  const r = run(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /api-specification\/ пуст/)
  rmSync(dir, { recursive: true, force: true })
})
test("CLI: непомеченная запись → exit 1 + файл:строка в stderr", () => {
  const dir = makePackage((_d, slice) =>
    writeFileSync(join(slice, "module-tree.md"), "# MT\n- head [as-is]\n- io без метки\n"))
  const r = run(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /module-tree\.md:3/)
  assert.match(r.stderr, /без провенанса/)
  rmSync(dir, { recursive: true, force: true })
})
