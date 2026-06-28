// Реестр скиллов + CI-инвариант ссылочной целостности ролей.
// Источник: frontmatter каждого skills/lib/<name>/SKILL.md и skills:-поле ролей.
// Выход: skills/INDEX.json (машинный реестр) + валидация.
//
// Запуск:
//   node harness/gen-skill-index.mjs           # перегенерировать skills/INDEX.json
//   node harness/gen-skill-index.mjs --check    # CI: проверить актуальность + ссылки (не писать)
//
// Инварианты (нарушение → exit 1):
//   1. У каждого скилла frontmatter с name (== имя каталога), version, description.
//   2. Каждый скилл из skills: роли существует в реестре и status == stable
//      (битая ссылка / незаведённый ПРОБЕЛ ловится здесь, а не молча).
//   3. Целостность пайплайна («роль = модуль»): каждый input роли либо внешний
//      (gate/CI/build/требования/общие логи), либо производится как output какого-то
//      апстрим-шага. Висячий артефакт (его никто не производит) → ошибка.
//   4. В режиме --check: skills/INDEX.json совпадает с тем, что сгенерировалось бы.

// Внешние источники входов — не производятся ролью-агентом (человек/CI/сборка/среда/
// общие append-логи). Вход из этого набора не требует апстрим-производителя.
const EXTERNAL_INPUTS = new Set([
  "requirements",        // постановка от дирижёра (Discovery)
  "ci-signals",          // сигналы CI (unit/component/contract/lint/security)
  "release-artifact",    // сборка после Gate #2 (merge)
  "metrics",             // метрики целевой среды
  "gate1", "gate2",      // человеческие гейты (акцепт плана / мерж)
  ".agent/memory.md",    // рабочая память цикла (общая)
  ".agent/decisions.log", // трассировка решений (общий append-лог)
])

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { parseFrontmatter } from "./frontmatter.mjs"

const ROOT = dirname(fileURLToPath(import.meta.url))
const LIB = join(ROOT, "..", "skills", "lib")
const SHARED = join(ROOT, "agents", "_shared")
const INDEX = join(ROOT, "..", "skills", "INDEX.json")
const ROLES = ["orchestrator", "planner", "plan-reviewer", "implementer", "fixer", "release-health"]
const CHECK = process.argv.includes("--check")

const errors = []

// --- Реестр скиллов из skills/lib/<name>/SKILL.md ---
const skills = []
for (const ent of readdirSync(LIB, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!ent.isDirectory()) continue
  const skillPath = join(LIB, ent.name, "SKILL.md")
  if (!existsSync(skillPath)) { errors.push(`skills/lib/${ent.name}/ — нет SKILL.md`); continue }
  const { data } = parseFrontmatter(readFileSync(skillPath, "utf8"))
  if (!data) { errors.push(`${ent.name}/SKILL.md — нет frontmatter`); continue }
  for (const f of ["name", "version", "description"]) {
    if (data[f] === undefined) errors.push(`${ent.name}/SKILL.md — нет поля '${f}'`)
  }
  if (data.name !== undefined && data.name !== ent.name) {
    errors.push(`${ent.name}/SKILL.md — name '${data.name}' ≠ имя каталога '${ent.name}'`)
  }
  skills.push({
    name: ent.name,
    path: `skills/lib/${ent.name}/SKILL.md`,
    version: data.version ?? null,
    status: data.status ?? "stable",
    description: data.description ?? null,
  })
}
const byName = new Map(skills.map((s) => [s.name, s]))

// --- Ссылочная целостность ролей (skills: → реестр) ---
const roles = []
for (const role of ROLES) {
  const { data } = parseFrontmatter(readFileSync(join(SHARED, `${role}.md`), "utf8"))
  const used = (data && data.skills) || []
  const inputs = (data && data.inputs) || []
  const outputs = (data && data.outputs) || []
  roles.push({ role, skills: used, inputs, outputs })
  for (const name of used) {
    const s = byName.get(name)
    if (!s) errors.push(`роль ${role}: скилл '${name}' не существует (битая ссылка или незаведённый ПРОБЕЛ → в SKILLS-BACKLOG)`)
    else if (s.status !== "stable") errors.push(`роль ${role}: скилл '${name}' имеет status='${s.status}', роль может ссылаться только на stable`)
  }
}

// --- Целостность пайплайна: каждый input производится апстримом или внешний ---
// ROLES задаёт порядок (orchestrator → planner → … → release-health). «Апстрим» роли i —
// объединение outputs ролей 0..i-1. Это обобщение outputs[N] ⊇ inputs[N+1] на реальный DAG.
const upstream = new Set()
for (const r of roles) {
  for (const inp of r.inputs) {
    if (!EXTERNAL_INPUTS.has(inp) && !upstream.has(inp)) {
      errors.push(`роль ${r.role}: вход '${inp}' не производится ни одним апстрим-шагом и не объявлен внешним (висячий артефакт пайплайна)`)
    }
  }
  for (const out of r.outputs) upstream.add(out)
}

// --- Сборка INDEX.json ---
const index = {
  _note: "СГЕНЕРИРОВАНО harness/gen-skill-index.mjs — не редактировать вручную. Перегенерация: node harness/gen-skill-index.mjs",
  skills,
  roles,
}
const json = JSON.stringify(index, null, 2) + "\n"

if (errors.length) {
  console.error("Нарушения целостности скиллов/ролей:")
  for (const e of errors) console.error(`  ✗ ${e}`)
  process.exit(1)
}

if (CHECK) {
  const current = existsSync(INDEX) ? readFileSync(INDEX, "utf8") : ""
  if (current !== json) {
    console.error("skills/INDEX.json устарел — перегенерируй: node harness/gen-skill-index.mjs")
    process.exit(1)
  }
  console.log(`OK: ${skills.length} скиллов, ${roles.length} ролей — реестр актуален, ссылки целы`)
} else {
  writeFileSync(INDEX, json)
  console.log(`skills/INDEX.json: ${skills.length} скиллов, ${roles.length} ролей — ссылки целы`)
}
