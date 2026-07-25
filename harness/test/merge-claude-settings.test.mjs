// P4: слияние харнес-проводки в существующий .claude/settings.json — идемпотентно, без потери
// пользовательских хуков/пермишенов; doctor-check ловит расхождение.
import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"

const HERE = dirname(fileURLToPath(import.meta.url))
const TOOL = join(HERE, "..", "merge-claude-settings.mjs")

const MANAGED = {
  permissions: { defaultMode: "bypassPermissions", allow: ["Bash(node *)", "Bash(git *)"] },
  hooks: {
    PreToolUse: [
      { matcher: "Task", hooks: [{ type: "command", command: 'node "/h/gate-check.mjs"' }] },
      { matcher: "Bash", hooks: [{ type: "command", command: 'node "/h/gate-bash.mjs"' }] },
    ],
    // gate-approve стоит в ДВУХ событиях: печатный токен (UserPromptSubmit) и выбор пункта меню
    // (PostToolUse[AskUserQuestion]) — зеркало enforcement/claude/settings.harness.json.
    PostToolUse: [
      { matcher: "Task", hooks: [{ type: "command", command: 'node "/h/log-decision.mjs"' }] },
      { matcher: "AskUserQuestion", hooks: [{ type: "command", command: 'node "/h/gate-approve.mjs"' }] },
    ],
    UserPromptSubmit: [{ hooks: [{ type: "command", command: 'node "/h/gate-approve.mjs"' }] }],
  },
}

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "merge-settings-"))
  const managed = join(dir, "managed.json")
  const settings = join(dir, "settings.json")
  writeFileSync(managed, JSON.stringify(MANAGED))
  return { dir, managed, settings }
}
const merge = (settings, managed) => execFileSync("node", [TOOL, "merge", settings, managed])
const check = (settings) => { try { execFileSync("node", [TOOL, "check", settings]); return 0 } catch (e) { return e.status } }
const read = (p) => JSON.parse(readFileSync(p, "utf8"))

test("merge в отсутствующий settings.json — создаёт с проводкой + маркером", () => {
  const { dir, managed, settings } = setup()
  merge(settings, managed)
  const s = read(settings)
  assert.equal(s.hooks.PreToolUse.length, 2)
  assert.ok(s["//rationaldev"].hooksSha)
  assert.equal(check(settings), 0)
  rmSync(dir, { recursive: true, force: true })
})

test("merge идемпотентен — повтор не дублирует управляемые хуки", () => {
  const { dir, managed, settings } = setup()
  merge(settings, managed); merge(settings, managed); merge(settings, managed)
  const s = read(settings)
  assert.equal(s.hooks.PreToolUse.length, 2, "gate-check/gate-bash не должны дублироваться")
  assert.equal(s.hooks.PostToolUse.length, 2, "log-decision + gate-approve[AskUserQuestion]")
  rmSync(dir, { recursive: true, force: true })
})

test("merge сохраняет пользовательские хуки/пермишены/ключи", () => {
  const { dir, managed, settings } = setup()
  writeFileSync(settings, JSON.stringify({
    env: { MY: "1" },
    permissions: { allow: ["Bash(mytool *)"] },
    hooks: { PreToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "node /u/hook.mjs" }] }] },
  }))
  merge(settings, managed)
  const s = read(settings)
  assert.deepEqual(s.env, { MY: "1" })
  assert.ok(s.permissions.allow.includes("Bash(mytool *)"), "пользовательский permission сохранён")
  assert.ok(s.permissions.allow.includes("Bash(node *)"), "управляемый permission добавлен")
  const pre = s.hooks.PreToolUse
  assert.equal(pre.filter((h) => h.matcher === "Write").length, 1, "пользовательский Write-хук сохранён")
  assert.equal(pre.filter((h) => JSON.stringify(h).includes("gate-check.mjs")).length, 1)
  rmSync(dir, { recursive: true, force: true })
})

test("merge не перетирает пользовательский defaultMode", () => {
  const { dir, managed, settings } = setup()
  writeFileSync(settings, JSON.stringify({ permissions: { defaultMode: "acceptEdits" } }))
  merge(settings, managed)
  assert.equal(read(settings).permissions.defaultMode, "acceptEdits")
  rmSync(dir, { recursive: true, force: true })
})

test("check краснеет (exit != 0) на удалённом управляемом хуке", () => {
  const { dir, managed, settings } = setup()
  merge(settings, managed)
  const s = read(settings)
  s.hooks.PreToolUse = s.hooks.PreToolUse.filter((h) => !JSON.stringify(h).includes("gate-check.mjs"))
  writeFileSync(settings, JSON.stringify(s))
  assert.notEqual(check(settings), 0)
  rmSync(dir, { recursive: true, force: true })
})

test("check краснеет на settings без маркера/файла", () => {
  const { dir, settings } = setup()
  writeFileSync(settings, JSON.stringify({ hooks: {} }))
  assert.notEqual(check(settings), 0)
  assert.notEqual(check(join(dir, "nope.json")), 0)
  rmSync(dir, { recursive: true, force: true })
})
