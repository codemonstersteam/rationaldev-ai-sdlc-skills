// Компонентный тест: харнес раздаёт ролям модели по harness/models.config.json
// (оркестратор делегирует роли с правильной моделью). Проверяет резолвинг
// roles[<роль>] > tiers[<тир>] > пусто на реальном выходе gen-agents.mjs.
//
// Прогон: node component-tests/model-distribution/run.mjs   (exit 0 = passed)
// Самовосстановление: меняет конфиг во временное состояние, потом возвращает исходный
// и перегенерирует проекции — рабочее дерево остаётся как было.
import { readFileSync, writeFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const CONFIG = join(ROOT, "harness", "models.config.json")
const GEN = join(ROOT, "harness", "gen-agents.mjs")
const AGENTS = join(ROOT, "harness", "agents")
const SHARED = join(AGENTS, "_shared")

const read = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n")
const gen = () => execFileSync("node", [GEN], { stdio: "ignore" })
const modelOf = (runner, role) => {
  const m = read(join(AGENTS, runner, `${role}.md`)).match(/^model:\s*(.+)$/m)
  return m ? m[1].trim() : null
}
const tierOf = (role) => read(join(SHARED, `${role}.md`)).match(/^tier:\s*(\S+)/m)[1]

const fails = []
const check = (cond, msg) => { if (!cond) fails.push(msg) }

const ROLES = ["orchestrator", "planner", "plan-reviewer", "implementer", "fixer", "release-health"]
const backup = readFileSync(CONFIG, "utf8")
try {
  // Разные модели на каждый тир + пер-ролевой оверрайд для implementer.
  const cfg = JSON.parse(backup)
  cfg.claude = { tiers: { large: "L-MODEL", medium: "M-MODEL", small: "S-MODEL" }, roles: { implementer: "OVR-MODEL" } }
  cfg.opencode = { tiers: { large: "", medium: "", small: "" }, roles: {} }
  writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + "\n")
  gen()

  const byTier = { large: "L-MODEL", medium: "M-MODEL", small: "S-MODEL" }
  for (const role of ROLES) {
    const tier = tierOf(role)
    // оверрайд роли важнее тира
    const want = role === "implementer" ? "OVR-MODEL" : byTier[tier]
    check(modelOf("claude", role) === want,
      `claude/${role}: тир=${tier} → ожидал model=${want}, получил ${modelOf("claude", role)}`)
  }
  // Реальное распределение: тиры large/medium/small дают РАЗНЫЕ модели (нет схлопывания).
  const distinct = new Set(ROLES.map((r) => modelOf("claude", r)))
  check(distinct.size >= 3, `ожидалось ≥3 различных моделей по ролям, получено ${distinct.size}`)
  // Оверрайд действительно перебил тир small (implementer ≠ S-MODEL).
  check(modelOf("claude", "implementer") === "OVR-MODEL", "пер-ролевой оверрайд implementer не применился")
  // Наследование: пустые тиры opencode → строки model: нет (роль берёт модель пользователя).
  check(modelOf("opencode", "planner") === null, "opencode/planner: при пустом тире model: быть не должно")
} finally {
  writeFileSync(CONFIG, backup) // вернуть исходный конфиг
  gen()                          // и перегенерировать проекции под него
}

if (fails.length) {
  console.error("FAIL model-distribution:\n - " + fails.join("\n - "))
  process.exit(1)
}
console.log("PASS model-distribution — роли получают модель по конфигу (тир + оверрайд + наследование)")
