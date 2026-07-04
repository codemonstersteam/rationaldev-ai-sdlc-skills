// Генератор проекций ролей под раннеры.
// Источник правды — frontmatter каждого harness/agents/_shared/<role>.md
// (идентичность роли: tier/mode/temperature/steps/permission/description).
// Выход: harness/agents/{claude,opencode,codex}/<role>.md + instructions/AGENTS.codex.md.
// Запуск: node harness/gen-agents.mjs   (Node >= 18)
//
// Один источник → три цели. Claude/OpenCode — файлы-агенты с frontmatter;
// Codex — тело-блок (frontmatter нет, собирается в AGENTS.md установщиком).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { parseFrontmatter } from "./frontmatter.mjs"
import { resolveModel as resolveModelCore, resolveTemp as resolveTempCore } from "./lib/resolve-model.mjs"

const ROOT = dirname(fileURLToPath(import.meta.url))
const SHARED = join(ROOT, "agents", "_shared")

// Тир (S/M/L) — абстракция размера роли (frontmatter `tier`). Конкретные имена
// моделей вынесены в harness/models.config.json (код генератора имён НЕ содержит —
// харнес не привязан к Anthropic). Резолвинг на роль: roles[<роль>] > tiers[<тир>] >
// (ничего → `model` опущен, раннер берёт модель пользователя).
const TIERS = ["large", "medium", "small"]
const MODELS = JSON.parse(readFileSync(join(ROOT, "models.config.json"), "utf8"))

// Резолвинг вынесен в чистое ядро harness/lib/resolve-model.mjs (юнит-тестируемо, config параметром).
// Здесь — тонкие обёртки, замыкающие MODELS (call sites не меняются).
const resolveModel = (runner, role, tier) => resolveModelCore(MODELS, runner, role, tier)
const resolveTemp = (runner, role, tier) => resolveTempCore(MODELS, runner, role, tier)

// Порядок ролей: точка входа (orchestrator) → пайплайн. Он же — порядок блоков в AGENTS.codex.md.
const ORDER = ["izi", "wirth-triage", "wirth-intake", "wirth-slicer", "wirth-usecase", "wirth-apidesigner", "wirth-moduledesigner", "wirth-ticketer", "wirth-planner", "mills", "scaffolder", "hughes", "wirth-tester", "linger", "michtom"]

function loadRole(role) {
  const text = readFileSync(join(SHARED, `${role}.md`), "utf8")
  const { data, body: raw } = parseFrontmatter(text)
  if (!data) throw new Error(`${role}.md: нет frontmatter (источник правды роли)`)
  for (const f of ["version", "tier", "mode", "temperature", "steps", "permission", "description", "skills", "inputs", "outputs"]) {
    if (data[f] === undefined) throw new Error(`${role}.md: в frontmatter нет поля '${f}'`)
  }
  if (!TIERS.includes(data.tier)) {
    throw new Error(`${role}.md: неизвестный tier '${data.tier}' (ожидается ${TIERS.join("/")})`)
  }
  return { data, body: raw.trim() + "\n" }
}

const q = (s) => (/[^a-zA-Z0-9_.\/-]/.test(s) ? `"${s}"` : s)

function permYaml(perm) {
  const lines = ["permission:"]
  for (const [k, v] of Object.entries(perm)) {
    if (typeof v === "string") { lines.push(`  ${k}: ${v}`); continue }
    lines.push(`  ${k}:`)
    for (const [g, gv] of Object.entries(v)) lines.push(`    ${q(g)}: ${gv}`)
  }
  return lines.join("\n")
}

function claudeFile(role, m, body, model) {
  const modelLine = model ? `model: ${model}\n` : ""
  return `---\nname: ${role}\ndescription: ${JSON.stringify(m.description)}\nversion: ${JSON.stringify(m.version)}\n${modelLine}---\n\n${body}`
}

function opencodeFile(role, m, body, model, temp) {
  const modelLine = model ? `model: ${model}\n` : ""
  const temperature = typeof temp === "number" ? temp : m.temperature
  // Атомарное тестирование шага: субагенты в OpenCode получают mode: all — вызываются
  // напрямую (`opencode --agent <role>` для теста одного шага) И остаются делегируемыми
  // из izi. Источник роли (`_shared`) остаётся `subagent` — это семантика контракта.
  const ocMode = m.mode === "subagent" ? "all" : m.mode
  return `---\ndescription: ${JSON.stringify(m.description)}\nversion: ${JSON.stringify(m.version)}\nmode: ${ocMode}\ntemperature: ${temperature}\nsteps: ${m.steps}\n${modelLine}${permYaml(m.permission)}\n---\n\n${body}`
}

function codexFile(role, m, body, _model) {
  return `<!-- role: ${role} (тир: ${m.tier}, v${m.version}). Frontmatter не нужен — блок собирается в AGENTS.md установщиком. -->\n\n${body}`
}

// Человекочитаемый контракт роли (проекция в skills/roles/<role>/<role>.md).
// На него ссылаются README / docs / GLOSSARY как на «манифест роли».
function roleContractFile(role, m, body) {
  const lines = body.split("\n")
  const h1 = lines[0]                                  // «# Planner — … (izi: …)»
  const rest = lines.slice(1).join("\n").replace(/^\n+/, "")
  const edit = m.permission.edit
    ? Object.entries(m.permission.edit).map(([g, a]) => `\`${g}\`: ${a}`).join(", ")
    : "—"
  const meta = [
    `- **Агент (izi):** ${m.izi}`,
    `- **Версия:** ${m.version}`,
    `- **Тир / модель (claude):** ${m.tier} → ${resolveModel("claude", role, m.tier) ?? "(наследуется)"}`,
    `- **Режим:** ${m.mode}`,
    `- **Запись (edit):** ${edit}`,
  ].join("\n")
  const head = "<!-- СГЕНЕРИРОВАНО из harness/agents/_shared/" + role +
    ".md — НЕ редактировать вручную.\n     Источник правды роли: frontmatter + тело там. " +
    "Перегенерация: node harness/gen-agents.mjs -->"
  return `${head}\n\n${h1}\n\n${meta}\n\n${rest}`
}

const roles = ORDER.map((role) => ({ role, ...loadRole(role) }))

let n = 0
for (const { role, data, body } of roles) {
  for (const [runner, render] of [["claude", claudeFile], ["opencode", opencodeFile], ["codex", codexFile]]) {
    const dir = join(ROOT, "agents", runner)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, `${role}.md`), render(role, data, body, resolveModel(runner, role, data.tier), resolveTemp(runner, role, data.tier)))
    n++
  }
  // 4-я проекция: человекочитаемый контракт роли в ../skills/roles/<role>/<role>.md
  const contractDir = join(ROOT, "..", "skills", "roles", role)
  mkdirSync(contractDir, { recursive: true })
  writeFileSync(join(contractDir, `${role}.md`), roleContractFile(role, data, body))
  n++
}

// --- Codex: собрать роутер + блоки ролей в один AGENTS.codex.md ---
// (у Codex нет файловых субагентов — роли укладываются в AGENTS.md)
let codex = `# AGENTS.md — харнес rationaldev (Codex)

Мультиагентный SDLC-харнес. Codex не имеет файловых субагентов — роли заданы ниже,
скиллы лежат в \`.agents/skills/\` (грузятся по имени). Точка входа — роль
**orchestrator** (дирижёр-роутер): классифицирует уровень задачи и ведёт по ролям.

Human-gates обязательны (за человеком). Рабочая память — \`.agent/memory.md\` (skill
\`memory\`); трассировка решений — \`.agent/decisions.log\`.
`
for (const { body } of roles) {
  codex += `\n---\n\n${body.trimEnd()}\n`
}
const instrDir = join(ROOT, "instructions")
mkdirSync(instrDir, { recursive: true })
writeFileSync(join(instrDir, "AGENTS.codex.md"), codex)

console.log(`generated ${n} files for ${roles.length} roles (claude/opencode/codex + skills/roles contract) + AGENTS.codex.md`)
