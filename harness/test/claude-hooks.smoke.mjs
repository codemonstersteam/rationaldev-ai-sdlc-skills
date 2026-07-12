// Смоук claude-хуков enforcement (gate-check / gate-bash) — паритет с opencode-плагином.
// Запуск: node harness/test/claude-hooks.smoke.mjs
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { existsSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const HOOKS = join(dirname(fileURLToPath(import.meta.url)), "..", "enforcement", "claude")
// exit-код хука на данном stdin-JSON (2 = блок, 0 = пропуск). env — доп. переменные (CLAUDE_PROJECT_DIR).
const runHook = (file, payload, env = {}) => {
  const r = spawnSync("node", [join(HOOKS, file)], { input: JSON.stringify(payload), env: { ...process.env, ...env } })
  return r.status
}
const task = (role) => ({ tool_input: { subagent_type: role } })
const bash = (command) => ({ tool_input: { command } })

let pass = 0
const dir = await mkdtemp(join(tmpdir(), "claude-hooks-"))

// gate-check: closed-set (проверяется ПЕРВЫМ — до фронтдора)
assert.equal(runHook("gate-check.mjs", task("general")), 2, "@general вне набора → блок"); pass++

// gate-check: фронтдор (poka-yoke) — пока нет brd.md, роутить можно ТОЛЬКО @gilb
assert.equal(runHook("gate-check.mjs", task("gilb"), { CLAUDE_PROJECT_DIR: dir }), 0, "@gilb без brd.md → пропуск (он и есть грил)"); pass++
assert.equal(runHook("gate-check.mjs", task("wirth-triage"), { CLAUDE_PROJECT_DIR: dir }), 2, "@wirth-triage без brd.md → блок (фронтдор)"); pass++
assert.equal(runHook("gate-check.mjs", task("mills"), { CLAUDE_PROJECT_DIR: dir }), 2, "@mills без brd.md → блок (фронтдор)"); pass++

// после грила (brd.md есть) пайплайн открыт; реализаторы всё ещё ждут Gate #1
await mkdir(join(dir, ".agent", "planner"), { recursive: true })
await writeFile(join(dir, ".agent", "planner", "brd.md"), "# BRD\n")
assert.equal(runHook("gate-check.mjs", task("wirth-triage"), { CLAUDE_PROJECT_DIR: dir }), 0, "@wirth-triage с brd.md → пропуск"); pass++
assert.equal(runHook("gate-check.mjs", task("mills"), { CLAUDE_PROJECT_DIR: dir }), 0, "@mills с brd.md → пропуск (не реализатор)"); pass++
assert.equal(runHook("gate-check.mjs", task("hughes"), { CLAUDE_PROJECT_DIR: dir }), 2, "@hughes с brd.md, но без Gate #1 → блок"); pass++

// gate-bash: само-запись маркера
assert.equal(runHook("gate-bash.mjs", bash("touch .agent/gates/gate1.approved")), 2, "touch gate1 → блок"); pass++
assert.equal(runHook("gate-bash.mjs", bash("echo x > .agent/gates/gate1.approved")), 2, "> gate1 → блок"); pass++
assert.equal(runHook("gate-bash.mjs", bash("ls .agent/gates/gate1.approved")), 0, "ls gate1 (чтение) → пропуск"); pass++

// gate-bash: poka-yoke green-маркер
await mkdir(join(dir, "docs", "design", "slice-x", "tickets"), { recursive: true })
await writeFile(join(dir, "docs", "design", "slice-x", "tickets", "ticket-05.md"),
  "---\nid: 05\ntype: module\noutputs: [internal/x/logic.go]\n---\n")
const green = bash('echo "ticket-05 slice-x green" >> .agent/planner/done.log')
assert.equal(runHook("gate-bash.mjs", green, { CLAUDE_PROJECT_DIR: dir }), 2, "green без output → блок"); pass++
await mkdir(join(dir, "internal", "x"), { recursive: true })
await writeFile(join(dir, "internal", "x", "logic.go"), "package x\n")
assert.equal(runHook("gate-bash.mjs", green, { CLAUDE_PROJECT_DIR: dir }), 0, "green с непустым output → пропуск"); pass++

// fail-open: битый JSON не блокирует
assert.equal(spawnSync("node", [join(HOOKS, "gate-bash.mjs")], { input: "not json" }).status, 0, "битый JSON → fail-open"); pass++

// gate-approve: UserPromptSubmit ставит маркер Gate #1 на «акцепт» (паритет с opencode chat.message)
const adir = await mkdtemp(join(tmpdir(), "claude-approve-"))
const marker = join(adir, ".agent", "gates", "gate1.approved")
runHook("gate-approve.mjs", { prompt: "ну что, поехали дальше" }, { CLAUDE_PROJECT_DIR: adir })
assert.ok(!existsSync(marker), "не-акцепт → маркера нет"); pass++
runHook("gate-approve.mjs", { prompt: "акцепт, план ок" }, { CLAUDE_PROJECT_DIR: adir })
assert.ok(existsSync(marker), "«акцепт» → маркер создан"); pass++
const first = readFileSync(marker, "utf8")
runHook("gate-approve.mjs", { prompt: "approve again" }, { CLAUDE_PROJECT_DIR: adir })
assert.equal(readFileSync(marker, "utf8"), first, "повтор не клобберит первый акцепт"); pass++
await rm(adir, { recursive: true, force: true })

await rm(dir, { recursive: true, force: true })
console.log(`PASS ${pass}/16 — claude hooks smoke (closed-set + фронтдор + Gate #1 + poka-yoke + gate-write + approve)`)
