// Общая ЧИСТАЯ логика enforcement — ЕДИНЫЙ ИСТОЧНИК для opencode-плагина (.ts) и claude-хуков (.mjs).
// Без node:fs и прочих builtin (только константы/regex/парсеры) → импортируется любым рантаймом без риска.
// fs-часть (найти тикет, stat выходов) делает КАЖДЫЙ вызывающий сам — здесь только дрейф-опасная логика.

// Строка-маркер акцепта Gate #1 (ставит только оператор вне сессии).
export const GATE_MARK = ".agent/gates/gate1.approved"

// Замкнутый набор пайплайн-ролей. Делегация `task`/`Task` вне набора (@general и пр.) = мис-роут.
export const PIPELINE = new Set([
  "izi", "gilb", "wirth-triage", "wirth-intake", "wirth-slicer", "wirth-usecase", "wirth-apidesigner",
  "wirth-moduledesigner", "dijkstra", "wirth-ticketer", "wirth-planner", "mills",
  "scaffolder", "hughes", "wirth-tester", "linger", "fagan", "michtom",
])

// Реализаторы, заблокированные до Gate #1 (нужны plan-review.md + gate1.approved).
export const IMPLEMENTERS = new Set(["hughes", "wirth-tester", "scaffolder"])

// Маркер прохождения фронтдора: @gilb пишет измеримый BRD сюда. Пока файла нет — грил не пройден.
export const BRD_MARK = ".agent/planner/brd.md"

// Фронтдор (poka-yoke). Пока нет brd.md, ЕДИНственная разрешённая делегация — @gilb: он превращает
// сырое BR в измеримый BRD и грилит открытые вопросы. Всё остальное (триаж/планирование/реализация) —
// заблокировано. Проза в izi.md не держит (модель рационализирует «триаж — вход конвейера»); держит хук.
// izi — не цель делегации (он роутер), поэтому в проверке участвует только целевая роль.
export const requiresFrontDoor = (role) => normRole(role) !== "gilb"

// Gate #1 акцепт валиден ТОЛЬКО когда план СОБРАН и презентован (есть PLAN.md планировщика ИЛИ
// plan-review.md критика). Иначе операторское «go ahead»/«акцепт» на ранней фазе (вопросы/дизайн)
// ложно ставит маркер и обнуляет человеческий гейт — баг: маркер до презентации плана (run 12-07:
// «go ahead» на фазе OQ поставил gate1 за час до плана). Пути-сигналы (fs-проверку делает вызывающий):
export const PLAN_REVIEW_MARK = ".agent/plan-reviewer/plan-review.md"
export const DESIGN_DIR = "docs/design" // PLAN.md лежит per-slice: docs/design/<slice>/PLAN.md
// Готов ли план к акцепту? existsFn(relPath)→bool, slicesFn()→string[] имён под DESIGN_DIR (оба от вызывающего).
export function planReadyForApproval(existsFn, sliceDirsFn) {
  if (existsFn(PLAN_REVIEW_MARK)) return true
  for (const slice of sliceDirsFn() || []) if (existsFn(DESIGN_DIR + "/" + slice + "/PLAN.md")) return true
  return false
}

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
