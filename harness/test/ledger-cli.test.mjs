// ledger.mjs как CLI: репозиторий БЕЗ заметок — журнал собирается, а git не шумит в stderr.
// Регрессия: `--notes=ledger` на отсутствующем ref печатал «notes ref refs/notes/ledger is invalid».
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const LEDGER = join(dirname(fileURLToPath(import.meta.url)), "..", "ledger.mjs")

function repoWithoutNotes() {
  const dir = mkdtempSync(join(tmpdir(), "ledger-cli-"))
  const git = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8" })
  git("init", "--quiet", "--initial-branch=main")
  git("config", "user.email", "t@t"); git("config", "user.name", "t")
  writeFileSync(join(dir, "f.txt"), "x\n")
  git("add", "-A")
  git("commit", "--quiet", "-m", "feat: первый коммит\n\nRun: demo\nWeight: minor\nTask: демо")
  return dir
}

test("нет refs/notes/ledger → stderr молчит (шум git не выдаётся за проблему)", () => {
  const dir = repoWithoutNotes()
  const r = spawnSync("node", [LEDGER, "--repo", dir, "--no-fetch"], { encoding: "utf8" })
  assert.equal(r.status, 0)
  assert.doesNotMatch(r.stderr || "", /notes ref/, `git шумит в stderr: ${r.stderr}`)
  rmSync(dir, { recursive: true, force: true })
})

test("журнал без заметок всё равно собирается (деградация, а не отказ)", () => {
  const dir = repoWithoutNotes()
  const r = spawnSync("node", [LEDGER, "--repo", dir, "--no-fetch", "--json"], { encoding: "utf8" })
  assert.equal(r.status, 0)
  assert.doesNotMatch(r.stderr || "", /notes ref/)
  assert.match(r.stdout, /^\[/, "на выходе JSON-массив, даже если записей нет")
  rmSync(dir, { recursive: true, force: true })
})
