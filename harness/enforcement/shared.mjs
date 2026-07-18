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
  "git-hand", // VCS-порт: start (ветка от транка) + terminal (commit/push/PR/CI)
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

// On-trunk poka-yoke. Реализаторы НЕ работают на транке: сначала @git-hand mode=start режет ветку от
// свежего транка (правило старта работы, git-conventions «MUST NOT commit to trunk»). Проза в izi.md не
// держит — держит хук: реализатор + HEAD на транке → блок «сначала @git-hand». @git-hand НЕ реализатор
// (он-то ветку и режет) → не блокируется. fs-часть (чтение .git/HEAD) делает вызывающий; здесь — парсер+набор.
export const TRUNK_BRANCHES = new Set(["main", "master", "trunk"])
// Имя текущей ветки из содержимого .git/HEAD (`ref: refs/heads/<branch>`); detached-HEAD (сырой sha) → null.
export function branchFromHead(headContent) {
  const m = /^ref:\s*refs\/heads\/(.+?)\s*$/m.exec(String(headContent || ""))
  return m ? m[1] : null
}
export const isTrunkBranch = (branch) => TRUNK_BRANCHES.has(String(branch || "").trim())

// Gate #1 акцепт валиден ТОЛЬКО когда план СОБРАН и презентован (есть PLAN.md планировщика ИЛИ
// plan-review.md критика). Иначе операторское «go ahead»/«акцепт» на ранней фазе (вопросы/дизайн)
// ложно ставит маркер и обнуляет человеческий гейт — баг: маркер до презентации плана (run 12-07:
// «go ahead» на фазе OQ поставил gate1 за час до плана). Пути-сигналы (fs-проверку делает вызывающий):
export const PLAN_REVIEW_MARK = ".agent/plan-reviewer/plan-review.md"
export const DESIGN_DIR = "docs/design" // PLAN.md лежит per-slice: docs/design/<slice>/PLAN.md
// chore-полоса: одностраничный план вместо FRD/спеки/дизайна. Chore — репо-инфра, не слайс → живёт
// durable в docs/chores/<NNN-slug>/CHORE-PLAN.md (а не эфемерно в .agent/): своя папка = ревью-пригодно,
// переживает прогон (принцип «природа работы → durable папка»). Machines slug-агностичны (глобят docs/chores/*).
export const CHORES_DIR = "docs/chores"
export const CHORE_PLAN_FILE = "CHORE-PLAN.md"
export const MODE_MARK = ".agent/planner/mode"
// mode-маркер (пишет @wirth-triage) == "chore"? content от вызывающего (fs-чтение снаружи).
// Срезаем ведущий BOM (﻿) — Windows-тулзы (PowerShell Set-Content) пишут его; trim() его не берёт.
export const isChoreMode = (modeContent) => String(modeContent || "").replace(/^﻿/, "").trim() === "chore"
// Есть ли durable chore-план docs/chores/<slug>/CHORE-PLAN.md? choreDirsFn()→подкаталоги docs/chores/;
// existsFn(relPath)→bool (оба инжектит вызывающий — fs снаружи, ядро чистое/тестируемое).
export function hasChorePlan(choreDirsFn, existsFn) {
  for (const c of choreDirsFn() || []) if (existsFn(CHORES_DIR + "/" + c + "/" + CHORE_PLAN_FILE)) return true
  return false
}
// Готов ли план к акцепту? existsFn(relPath)→bool, sliceDirsFn()/choreDirsFn()→string[] имён подкаталогов
// под DESIGN_DIR / CHORES_DIR (все от вызывающего). chore: durable CHORE-PLAN.md — тоже «план собран».
export function planReadyForApproval(existsFn, sliceDirsFn, choreDirsFn = () => []) {
  if (existsFn(PLAN_REVIEW_MARK)) return true
  if (hasChorePlan(choreDirsFn, existsFn)) return true
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

// Текст выбора оператора из НАТИВНОГО меню opencode (event `question.replied`) — параллель chat.message-акцепту.
// На Gate #1 izi показывает `question` с опциями; выбор пункта opencode шлёт событием question.replied (v2-канал),
// а НЕ chat.message. Хук акцепта слушал только чат → выбор пункта не срабатывал, приходилось ПЕЧАТАТЬ «GATE1 APPROVE»
// (наблюдение прогона). Достаём лейблы выбранных опций (`answers` — вложенные массивы строк; ключ payload —
// `properties` в v1-обёртке события ИЛИ `data` в v2), склеиваем в строку; токен ли это — решает isOperatorApproval.
// io: none, никогда не бросает; не-question-событие → "".
export function answerTextFromEvent(event) {
  const type = String(event?.type || "")
  if (!(type.includes("question") && type.includes("replied"))) return ""
  const body = event?.properties ?? event?.data ?? {}
  const out = []
  const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (typeof v === "string") out.push(v) }
  walk(body?.answers)
  return out.join(" ")
}

// ── anti-loop: детект застревания субагента (петля без прогресса) ────────────
// Субагент (напр. hughes/Qwen на конфликте типа) уходит в петлю повтора ОДНОГО действия без
// новых outputs. Детект — по СИГНАТУРАМ tool-call'ов: канонизируем (tool + отсортированные args);
// хвост = K подряд одинаковых ИЛИ короткий цикл (период 2..maxPeriod), повторённый cycleRepeats раз
// → петля. Гардрэйл на детекте бросает → турн падает как dropout → izi эскалирует (@linger/split, T04).
// Прогресс (иной вызов) естественно рвёт паттерн → нет ложняка. Чисто (io: none), тестируемо.
export function toolCallSignature(tool, args) {
  const norm = (v) => {
    if (Array.isArray(v)) return v.map(norm)
    if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, norm(v[k])]))
    return v
  }
  let a
  try { a = JSON.stringify(norm(args ?? {})) } catch { a = String(args) }
  return `${tool} ${a}`
}

export function detectLoop(sigs, { runThreshold = 5, cycleRepeats = 3, maxPeriod = 3 } = {}) {
  const n = sigs.length
  // 1) K подряд одинаковых (одно и то же действие без изменений)
  if (n >= runThreshold && sigs.slice(n - runThreshold).every((s) => s === sigs[n - 1])) return sigs[n - 1]
  // 2) короткий цикл A,B,(A,B,…) периода 2..maxPeriod, повторённый cycleRepeats раз (read↔edit-петля)
  for (let p = 2; p <= maxPeriod; p++) {
    const need = p * cycleRepeats
    if (n < need) continue
    const tail = sigs.slice(n - need)
    let cyclic = true
    for (let i = p; i < need; i++) if (tail[i] !== tail[i - p]) { cyclic = false; break }
    if (cyclic) return tail.slice(0, p).join(" | ")
  }
  return null
}
