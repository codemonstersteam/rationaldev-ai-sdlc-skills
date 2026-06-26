// Генератор проекций ролей под раннеры.
// Источник: harness/agents/_shared/<role>.md (общее тело) + META ниже.
// Выход: harness/agents/{claude,opencode,codex}/<role>.md.
// Запуск: node harness/gen-agents.mjs   (Node >= 18)
//
// Один источник → три цели. Claude/OpenCode — файлы-агенты с frontmatter;
// Codex — тело-блок (frontmatter нет, собирается в AGENTS.md установщиком).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = dirname(fileURLToPath(import.meta.url))
const SHARED = join(ROOT, "agents", "_shared")

// tier → модель Claude (алиасы); OpenCode наследует модель пользователя (model опущен).
const CLAUDE_MODEL = { big: "opus", small: "sonnet" }

const META = {
  orchestrator: {
    desc: "Дирижёр-роутер: точка входа, классифицирует уровень задачи, делегирует роли, держит human-gates. Keywords: оркестрация, роутинг, делегирование, gate, уровень задачи, SDLC.",
    tier: "big", mode: "primary", temp: 0.2, steps: 40,
    perm: { task: "allow", read: "allow", grep: "allow", glob: "allow", list: "allow", webfetch: "ask", bash: "ask",
            edit: { ".agent/**": "allow", "*": "deny" } },
  },
  planner: {
    desc: "Планировщик (Wirth): проектирует вертикальные срезы, контракты модулей, карту режимов отказа. Вызывать на модульных задачах ПЕРЕД реализацией. Keywords: план, дизайн, контракт, OpenAPI, срезы, архитектура.",
    tier: "big", mode: "subagent", temp: 0.3, steps: 30,
    perm: { read: "allow", grep: "allow", glob: "allow", list: "allow", bash: "ask",
            edit: { ".agent/**": "allow", "api-specification/**": "allow", "contracts/**": "allow", "*": "deny" } },
  },
  "plan-reviewer": {
    desc: "Ревьюер плана (критик): проверяет полноту и связность плана перед Gate #1. НЕ тот, кто писал план. Вызывать после planner. Keywords: ревью плана, проверка дизайна, вердикт, полнота.",
    tier: "big", mode: "subagent", temp: 0.1, steps: 20,
    perm: { read: "allow", grep: "allow", glob: "allow", list: "allow", bash: "deny",
            edit: { ".agent/plan-reviewer/**": "allow", ".agent/decisions.log": "allow", "*": "deny" } },
  },
  implementer: {
    desc: "Имплементатор (Hughes): пишет код строго по утверждённому плану, один срез = один PR. После Gate #1 или сразу на тривиальной задаче. Keywords: реализация, код, TDD, slice, имплементация, PR.",
    tier: "small", mode: "subagent", temp: 0.2, steps: 50,
    perm: { read: "allow", grep: "allow", glob: "allow", list: "allow", bash: "allow", lsp: "allow",
            edit: { "tests/**": "ask", "**/*_test.*": "ask", ".ci/**": "ask", ".github/**": "ask", "api-specification/**": "ask", "*": "allow" } },
  },
  fixer: {
    desc: "Фиксер/ревьюер кода (Linger): классифицирует ошибки CI (дефект плана vs реализации), чинит по сигналам или выдаёт code-review вердикт перед Gate #2. Keywords: ревью кода, фикс, CI, классификация ошибки, баг.",
    tier: "big", mode: "subagent", temp: 0.1, steps: 40,
    perm: { read: "allow", grep: "allow", glob: "allow", list: "allow", bash: "allow", lsp: "allow",
            edit: { "tests/**": "ask", ".ci/**": "ask", "api-specification/**": "ask", "*": "allow" } },
  },
  "release-health": {
    desc: "Релиз и здоровье (Michtom): канареечный выкат за фиче-тогглом + оценка golden signals, вердикт GREEN/YELLOW/RED, решение об откате. Keywords: релиз, деплой, канарейка, rollout, health, SLO, откат.",
    tier: "small", mode: "subagent", temp: 0.1, steps: 25,
    perm: { read: "allow", grep: "allow", glob: "allow", list: "allow", bash: "allow",
            edit: { ".agent/release-health/**": "allow", ".agent/decisions.log": "allow", "*": "deny" } },
  },
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

function claudeFile(role, m, body) {
  return `---\nname: ${role}\ndescription: ${JSON.stringify(m.desc)}\nmodel: ${CLAUDE_MODEL[m.tier]}\n---\n\n${body}`
}

function opencodeFile(role, m, body) {
  return `---\ndescription: ${JSON.stringify(m.desc)}\nmode: ${m.mode}\ntemperature: ${m.temp}\nsteps: ${m.steps}\n${permYaml(m.perm)}\n---\n\n${body}`
}

function codexFile(role, m, body) {
  return `<!-- role: ${role} (тир: ${m.tier}). Frontmatter не нужен — блок собирается в AGENTS.md установщиком. -->\n\n${body}`
}

let n = 0
for (const [role, m] of Object.entries(META)) {
  const body = readFileSync(join(SHARED, `${role}.md`), "utf8").trimEnd() + "\n"
  for (const [runner, render] of [["claude", claudeFile], ["opencode", opencodeFile], ["codex", codexFile]]) {
    const dir = join(ROOT, "agents", runner)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, `${role}.md`), render(role, m, body))
    n++
  }
}
// --- Codex: собрать роутер + блоки ролей в один AGENTS.codex.md ---
// (у Codex нет файловых субагентов — роли укладываются в AGENTS.md)
const ORDER = ["orchestrator", "planner", "plan-reviewer", "implementer", "fixer", "release-health"]
let codex = `# AGENTS.md — харнес rationaldev (Codex)

Мультиагентный SDLC-харнес. Codex не имеет файловых субагентов — роли заданы ниже,
скиллы лежат в \`.agents/skills/\` (грузятся по имени). Точка входа — роль
**orchestrator** (дирижёр-роутер): классифицирует уровень задачи и ведёт по ролям.

Human-gates обязательны (за человеком). Рабочая память — \`.agent/memory.md\` (skill
\`memory\`); трассировка решений — \`.agent/decisions.log\`.
`
for (const role of ORDER) {
  const body = readFileSync(join(SHARED, `${role}.md`), "utf8").trimEnd()
  codex += `\n---\n\n${body}\n`
}
const instrDir = join(ROOT, "instructions")
mkdirSync(instrDir, { recursive: true })
writeFileSync(join(instrDir, "AGENTS.codex.md"), codex)

console.log(`generated ${n} agent files for ${Object.keys(META).length} roles × 3 runners + AGENTS.codex.md`)
