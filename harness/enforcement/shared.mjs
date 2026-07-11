// Общая ЧИСТАЯ логика enforcement — ЕДИНЫЙ ИСТОЧНИК для opencode-плагина (.ts) и claude-хуков (.mjs).
// Без node:fs и прочих builtin (только константы/regex/парсеры) → импортируется любым рантаймом без риска.
// fs-часть (найти тикет, stat выходов) делает КАЖДЫЙ вызывающий сам — здесь только дрейф-опасная логика.

// Строка-маркер акцепта Gate #1 (ставит только оператор вне сессии).
export const GATE_MARK = ".agent/gates/gate1.approved"

// Замкнутый набор пайплайн-ролей. Делегация `task`/`Task` вне набора (@general и пр.) = мис-роут.
export const PIPELINE = new Set([
  "izi", "gilb", "wirth-triage", "wirth-intake", "wirth-slicer", "wirth-usecase", "wirth-apidesigner",
  "wirth-moduledesigner", "wirth-ticketer", "wirth-planner", "mills",
  "scaffolder", "hughes", "wirth-tester", "linger", "fagan", "michtom",
])

// Реализаторы, заблокированные до Gate #1 (нужны plan-review.md + gate1.approved).
export const IMPLEMENTERS = new Set(["hughes", "wirth-tester", "scaffolder"])

// Ключи, под которыми раннеры кладут имя роли в аргументы task-инструмента.
export const ROLE_KEYS = ["subagent", "subagentType", "subagent_type", "agent", "agentType"]

export function pickRole(args) {
  if (!args || typeof args !== "object") return "unknown"
  for (const k of ROLE_KEYS) if (typeof args[k] === "string") return args[k]
  return "unknown"
}

export const normRole = (role) => String(role).toLowerCase().replace(/^@/, "").trim()
export const isImplementer = (role) => IMPLEMENTERS.has(normRole(role))
export const inPipeline = (role) => PIPELINE.has(normRole(role))

// bash-команда СОЗДАЁТ/ПИШЕТ маркер Gate #1? (чтение — ls/test/cat/stat — НЕ ловим: izi должен верифицировать)
export function writesGateMarker(cmd) {
  const gm = GATE_MARK.replace(/[.]/g, "\\.")
  return new RegExp(`>>?\\s*['"]?[^\\s;|&'"]*${gm}`).test(cmd) ||
         new RegExp(`\\b(touch|tee|cp|mv|ln|install|dd)\\b[^;|&]*${gm}`).test(cmd)
}

// bash-команда пишет `ticket-NN <...> green` в .agent/planner/done.log? → id тикета (строка) или null.
export function doneGreenTicketId(cmd) {
  const doneWrite = />>?\s*['"]?[^\s;|&'"]*\.agent\/planner\/done\.log/.test(cmd)
  if (!doneWrite) return null
  const mk = /\bticket-0*(\d+)\b[^\n]*\bgreen\b/.exec(cmd)
  return mk ? mk[1] : null
}

// Разобрать `outputs: [a, b, …]` (flow-массив) из тела тикета → массив путей.
export function parseTicketOutputs(text) {
  const m = /^outputs:\s*\[([^\]]*)\]/m.exec(text)
  if (!m) return []
  return m[1].split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean)
}

// Оператор написал «акцепт/approve/go ahead» (Gate #1 акцепт из чата)?
export function isOperatorApproval(text) {
  return /(^|[\s.,!])(акцепт|акцептую|approve|принял план|gate1[- ]?ok|go ahead)([\s.,!]|$)/.test(String(text).toLowerCase())
}
