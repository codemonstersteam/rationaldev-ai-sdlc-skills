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
  "change-intake", "hughes-rework", // rework pipeline (доработка существующего кода)
])

// Реализаторы, заблокированные до Gate #1 (нужны plan-review.md + gate1.approved).
export const IMPLEMENTERS = new Set(["hughes", "wirth-tester", "scaffolder", "hughes-rework"])

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

// Явный ТОКЕН-КОМАНДА акцепта Gate #1 — НЕ свободный текст. Оператор ДОЛЖЕН написать «GATE1 APPROVE»
// (регистр не важен, опц. имя слайса после). Свободные «go ahead / approve / акцепт / принял план»
// БОЛЬШЕ НЕ считаются согласием: они ложно ставили человеческий гейт по случайной фразе (run 16-07:
// маркер за 20с после презентации плана по попутной реплике). Осознанный токен = poka-yoke, а не
// NLP-догадка. Ручной `touch` маркера оператором вне сессии — по-прежнему валиден (out-of-band).
export function isOperatorApproval(text) {
  return /\bgate1\s+approve\b/i.test(String(text))
}

// Содержимое маркера Gate #1 — PROVENANCE акцепта (аудит, НЕ enforcement: gate-check смотрит только
// существование файла, дрейф плана НЕ ре-блокирует). Несёт: когда, каким раннером, ПО КАКОЙ реплике
// оператора и хеш снимка плана НА ТОТ МИГ — чтобы акцепт был привязуем к реальному решению.
// planHash считает вызывающий (fs+crypto). Формат — TSV-строки; prompt санитизируется (без tab/newline).
export function gateMarkerContent({ timestamp, source, prompt, planHash }) {
  const one = (s) => String(s ?? "").replace(/[\t\r\n]+/g, " ").trim().slice(0, 500)
  return [
    `approved_at\t${timestamp}`,
    `source\t${source}`,
    `plan_hash\t${planHash ?? "na"}`,
    `prompt\t${one(prompt)}`,
    "",
  ].join("\n")
}
