// validate-design-sync: канон среза обязан быть сведён с принятой дельтой и нести её маркер.
// Ядро чистое (io инжектится) — формула: 1 happy + Σ ветвей antecedent (нет карты в каноне ·
// нет маркера · маркер чужой дельты · сводить нечего).
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { syncViolations, markerRe, SYNCED_MAPS } from "../validate-design-sync.mjs"

const VALIDATOR = join(dirname(fileURLToPath(import.meta.url)), "..", "validate-design-sync.mjs")
const canonOf = (map) => ({ "module-tree.md": "> Current as of change 001-arity (lane patch)\n\n# tree\n" }[map] ?? null)

test("happy: дельта тронула карту, канон её несёт с маркером этой дельты → нарушений нет", () => {
  assert.deepEqual(syncViolations([{ slug: "001-arity", maps: ["module-tree.md"] }], canonOf), [])
})

test("канон без маркера → дельта не сведена (молчаливое расхождение — то, ради чего гейт)", () => {
  const v = syncViolations([{ slug: "001-arity", maps: ["module-tree.md"] }], () => "# tree\n")
  assert.equal(v.length, 1)
  assert.match(v[0].why, /нет маркера/)
})

test("🔴 маркер ЧУЖОЙ дельты → нарушение (указывает на другой прогон = врёт так же)", () => {
  const v = syncViolations([{ slug: "002-report", maps: ["contracts.md"] }],
    () => "> Current as of change 001-arity (lane patch)\n")
  assert.equal(v.length, 1)
})

test("карты нет в каноне вовсе → нарушение с отдельной причиной", () => {
  const v = syncViolations([{ slug: "001-arity", maps: ["c4.md"] }], () => null)
  assert.match(v[0].why, /в каноне среза её нет/)
})

test("сводить нечего (дельта без карт дизайна) → пусто, гейт не придирается", () => {
  assert.deepEqual(syncViolations([{ slug: "003-docs", maps: [] }], canonOf), [])
})

test("markerRe: спецсимволы в слаге не ломают регексп", () => {
  assert.ok(markerRe("001-a.b+c").test("> Current as of change 001-a.b+c (lane minor)"))
  assert.equal(markerRe("001-arity").test("> Current as of change 001-other"), false)
})

test("SYNCED_MAPS: только карты дизайна; adr/ аддитивен и в список не входит", () => {
  assert.deepEqual(SYNCED_MAPS, ["module-tree.md", "contracts.md", "c4.md"])
})

// ── io-оболочка на настоящем дереве ─────────────────────────────────────────────
function tree({ marker }) {
  const root = mkdtempSync(join(tmpdir(), "design-sync-"))
  const slice = join(root, "docs", "design", "slice-01-x")
  mkdirSync(join(slice, "changes", "001-arity"), { recursive: true })
  writeFileSync(join(slice, "changes", "001-arity", "module-tree.md"), "# delta tree\n")
  writeFileSync(join(slice, "module-tree.md"), (marker ? "> Current as of change 001-arity (lane patch)\n\n" : "") + "# canon\n")
  return root
}

test("CLI: канон с маркером → exit 0", () => {
  const root = tree({ marker: true })
  const r = spawnSync("node", [VALIDATOR, root], { encoding: "utf8" })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /OK — канон синхронен/)
  rmSync(root, { recursive: true, force: true })
})

test("CLI: канон без маркера → exit 1 + путь нарушения и способ починки", () => {
  const root = tree({ marker: false })
  const r = spawnSync("node", [VALIDATOR, root], { encoding: "utf8" })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /slice-01-x\/module-tree\.md · дельта 001-arity/)
  assert.match(r.stderr, /canon-sync/)
  rmSync(root, { recursive: true, force: true })
})

test("CLI: репозиторий без change-папок → exit 0 (гейт не применяется)", () => {
  const root = mkdtempSync(join(tmpdir(), "design-sync-empty-"))
  mkdirSync(join(root, "docs", "design", "slice-01-x"), { recursive: true })
  const r = spawnSync("node", [VALIDATOR, root], { encoding: "utf8" })
  assert.equal(r.status, 0)
  rmSync(root, { recursive: true, force: true })
})
