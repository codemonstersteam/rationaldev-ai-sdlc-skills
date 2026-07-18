// Тесты обнаружения тикетов: greenfield tickets/ + change-scoped changes/<slug>/tickets/.
import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { discoverTicketFiles, sliceTicketDirs } from "../lib/ticket-fs.mjs"

function scaffold() {
  const root = mkdtempSync(join(tmpdir(), "ticket-fs-"))
  const slice = join(root, "docs", "design", "slice-01-x")
  mkdirSync(join(slice, "tickets"), { recursive: true })
  writeFileSync(join(slice, "tickets", "ticket-01.md"), "gf1")
  writeFileSync(join(slice, "tickets", "ticket-02.md"), "gf2")
  // change-scoped доработка (не затирает greenfield)
  const chDir = join(slice, "changes", "001-round-4dp", "tickets")
  mkdirSync(chDir, { recursive: true })
  writeFileSync(join(chDir, "ticket-01.md"), "rw1")
  return { root, slice }
}

test("discoverTicketFiles видит и greenfield, и change-scoped тикеты", () => {
  const { root } = scaffold()
  try {
    const rels = discoverTicketFiles(root).map((f) => f.rel).sort()
    assert.deepEqual(rels, [
      "docs/design/slice-01-x/changes/001-round-4dp/tickets/ticket-01.md",
      "docs/design/slice-01-x/tickets/ticket-01.md",
      "docs/design/slice-01-x/tickets/ticket-02.md",
    ])
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("greenfield ticket-01 и change ticket-01 сосуществуют (не затираются)", () => {
  const { root } = scaffold()
  try {
    const rels = discoverTicketFiles(root).map((f) => f.rel)
    assert.ok(rels.includes("docs/design/slice-01-x/tickets/ticket-01.md"))
    assert.ok(rels.includes("docs/design/slice-01-x/changes/001-round-4dp/tickets/ticket-01.md"))
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("sliceTicketDirs: own tickets первым, changes отсортированы", () => {
  const { root } = scaffold()
  try {
    const slice2 = join(root, "docs", "design", "slice-01-x", "changes", "002-b", "tickets")
    mkdirSync(slice2, { recursive: true })
    writeFileSync(join(slice2, "ticket-01.md"), "rw-b")
    const dirs = sliceTicketDirs(join(root, "docs", "design"), "slice-01-x").map((d) => d.rel)
    assert.deepEqual(dirs, [
      "docs/design/slice-01-x/tickets",
      "docs/design/slice-01-x/changes/001-round-4dp/tickets",
      "docs/design/slice-01-x/changes/002-b/tickets",
    ])
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("нет docs/design → пустой список, не падает", () => {
  const root = mkdtempSync(join(tmpdir(), "ticket-fs-empty-"))
  try { assert.deepEqual(discoverTicketFiles(root), []) }
  finally { rmSync(root, { recursive: true, force: true }) }
})
