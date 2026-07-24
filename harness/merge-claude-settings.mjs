// Слияние харнес-проводки (hooks/permissions) в СУЩЕСТВУЮЩИЙ .claude/settings.json проекта — вместо
// «положили settings.harness.json рядом, слей вручную». Кросс-платформенно (Node), зовут install.sh/install.ps1.
//
//   node harness/merge-claude-settings.mjs merge <settings.json> <managed.json>
//   node harness/merge-claude-settings.mjs check <settings.json>
//
// Управляемый блок опознаётся по ИМЕНАМ хук-файлов (gate-check/gate-bash/gate-approve/log-decision) —
// маркер не нужен, имена и есть маркер. merge идемпотентен: старые управляемые записи убираются, свежие
// дописываются; пользовательские хуки/пермишены НЕ теряются. sha управляемых хуков пишется в
// settings["//rationaldev"].hooksSha, чтобы `check` (rationaldev doctor) ловил расхождение с эталоном.
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { createHash } from "node:crypto"

const MANAGED_FILES = ["gate-check.mjs", "gate-bash.mjs", "gate-approve.mjs", "log-decision.mjs"]
// Ожидаемая проводка событие → хук-файл (для check: все на месте и в своём событии).
const EXPECTED = {
  PreToolUse: ["gate-check.mjs", "gate-bash.mjs"],
  PostToolUse: ["log-decision.mjs"],
  UserPromptSubmit: ["gate-approve.mjs"],
}

const sha = (obj) => createHash("sha256").update(JSON.stringify(obj)).digest("hex").slice(0, 16)
const mentionsManaged = (entry) => {
  const s = JSON.stringify(entry)
  return MANAGED_FILES.some((f) => s.includes(f))
}
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"))

// Управляемые хук-записи, присутствующие в settings.hooks (для sha и check).
function managedHooksOf(settings) {
  const out = {}
  const hooks = (settings && settings.hooks) || {}
  for (const ev of Object.keys(hooks)) {
    const kept = (hooks[ev] || []).filter(mentionsManaged)
    if (kept.length) out[ev] = kept
  }
  return out
}

function merge(settingsPath, managedPath) {
  const managed = readJson(managedPath)
  const settings = existsSync(settingsPath) ? readJson(settingsPath) : {}

  // permissions: defaultMode ставим только если не задан пользователем; allow — объединение (без потерь).
  if (managed.permissions) {
    settings.permissions = settings.permissions || {}
    if (managed.permissions.defaultMode && !settings.permissions.defaultMode)
      settings.permissions.defaultMode = managed.permissions.defaultMode
    if (Array.isArray(managed.permissions.allow)) {
      const set = new Set(settings.permissions.allow || [])
      for (const a of managed.permissions.allow) set.add(a)
      settings.permissions.allow = [...set]
    }
  }

  // hooks: для каждого события выкидываем СТАРЫЕ управляемые записи (по именам файлов), дописываем свежие.
  // Неуправляемые (пользовательские) хуки события сохраняются. Идемпотентно.
  settings.hooks = settings.hooks || {}
  for (const ev of Object.keys(managed.hooks || {})) {
    const userHooks = (settings.hooks[ev] || []).filter((e) => !mentionsManaged(e))
    settings.hooks[ev] = [...userHooks, ...managed.hooks[ev]]
  }

  settings["//rationaldev"] = { hooksSha: sha(managedHooksOf(settings)), managedFiles: MANAGED_FILES }
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n")
}

// Диагностика (rationaldev doctor): управляемый блок на месте, событие→хук совпадает, sha не тронут.
function check(settingsPath) {
  if (!existsSync(settingsPath)) { console.error(`нет ${settingsPath}`); process.exit(4) }
  let settings
  try { settings = readJson(settingsPath) } catch { console.error(`битый JSON: ${settingsPath}`); process.exit(4) }
  const marker = settings["//rationaldev"]
  if (!marker || !marker.hooksSha) { console.error("харнес-проводка не слита (нет маркера //rationaldev)"); process.exit(4) }
  const present = managedHooksOf(settings)
  for (const ev of Object.keys(EXPECTED)) {
    const s = JSON.stringify(present[ev] || [])
    for (const f of EXPECTED[ev]) if (!s.includes(f)) { console.error(`в ${ev} нет управляемого хука ${f}`); process.exit(3) }
  }
  if (sha(present) !== marker.hooksSha) { console.error("управляемый блок расходится с маркером (правили руками?)"); process.exit(3) }
  process.exit(0)
}

const [cmd, settingsPath, managedPath] = process.argv.slice(2)
if (cmd === "merge") {
  if (!settingsPath || !managedPath) { console.error("usage: merge <settings.json> <managed.json>"); process.exit(1) }
  merge(settingsPath, managedPath)
} else if (cmd === "check") {
  if (!settingsPath) { console.error("usage: check <settings.json>"); process.exit(1) }
  check(settingsPath)
} else {
  console.error("usage: node harness/merge-claude-settings.mjs <merge|check> <settings.json> [managed.json]")
  process.exit(1)
}
