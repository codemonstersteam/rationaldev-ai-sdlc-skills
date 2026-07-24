// rational-guardrail.mjs — SELF-CONTAINED enforcement-плагин для OpenCode.
// ПОЧЕМУ self-contained (.mjs, инлайн, без crypto/@opencode-ai/plugin):
//   opencode грузит ЛОКАЛЬНЫЙ .ts плагин через транспайл + резолв импортов + полифиллы (node:crypto →
//   crypto-browserify). В изолированной/банк-сети резолв/полифилл-фетч ВИСНЕТ и роняет старт opencode
//   (найдено live). omo работает, т.к. это PRE-BUILT dist/index.js (грузится напрямую). Старый рабочий
//   плагин был лёгким self-contained. Профиль-рецепт: plain .mjs, ноль внешних импортов, ноль crypto →
//   opencode грузит как есть, без бандла/фетча.
// SYNC: константы+чистые функции ниже — ИНЛАЙН-КОПИЯ из ../shared.mjs (единый источник для claude-хуков).
//   ДЕРЖАТЬ ИДЕНТИЧНО. Дрейф ловит harness/test/guardrail-sync.test.mjs (loader-check + drift) (сравнивает с shared.mjs).
import { appendFile, writeFile, mkdir, access, readFile, readdir, stat } from "node:fs/promises"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

// ── лёгкий non-crypto хеш (аудит-отпечатки: plan_hash/skillset_hash — НЕ безопасность) — заменяет node:crypto ──
// cyrb53: детерминирован, равный вход → равный хеш (достаточно для ring-buffer детекта петли и provenance).
const cyrb = (str, seed = 0) => {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)) >>> 0
}
const lightHash = (str, len = 16) =>
  (cyrb(str, 0).toString(16).padStart(8, "0") + cyrb(str, 0x9e3779b9).toString(16).padStart(8, "0") +
   cyrb(str, 0x85ebca6b).toString(16).padStart(8, "0")).slice(0, len)

// ── ИНЛАЙН из shared.mjs (SYNC — держать идентично) ─────────────────────────────
const GATE_MARK = ".agent/gates/gate1.approved"
const GATE2_MARK = ".agent/gates/gate2.approved"
const GATE_MARKS = [GATE_MARK, GATE2_MARK]
const PIPELINE = new Set([
  "izi", "gilb", "wirth-triage", "wirth-intake", "wirth-slicer", "wirth-usecase", "wirth-apidesigner",
  "wirth-moduledesigner", "dijkstra", "wirth-ticketer", "wirth-planner", "mills",
  "scaffolder", "hughes", "wirth-tester", "linger", "fagan", "michtom",
  "git-hand",
  "change-intake", "hughes-rework",
  "wirth-onboard",
  "ledger",
])
const IMPLEMENTERS = new Set(["hughes", "wirth-tester", "scaffolder", "hughes-rework"])
const RUN_CLOSERS = new Set(["ledger"])
const requiresFrontDoor = (role) => normRole(role) !== "gilb"
const TRUNK_BRANCHES = new Set(["main", "master", "trunk"])
function branchFromHead(headContent) {
  const m = /^ref:\s*refs\/heads\/(.+?)\s*$/m.exec(String(headContent || ""))
  return m ? m[1] : null
}
const isTrunkBranch = (branch) => TRUNK_BRANCHES.has(String(branch || "").trim())
const PLAN_REVIEW_MARK = ".agent/plan-reviewer/plan-review.md"
const DESIGN_DIR = "docs/design"
const CHORES_DIR = "docs/chores"
const CHORE_PLAN_FILE = "CHORE-PLAN.md"
const MODE_MARK = ".agent/planner/mode"
const CHANGE_DIR_MARK = ".agent/planner/change-dir"
const CHORE_DIR_MARK = ".agent/planner/chore-dir"
const SLICES_MARK = ".agent/planner/slices.md"
const isChoreMode = (modeContent) => String(modeContent || "").replace(/^﻿/, "").trim() === "chore"
function planPathUnder(pointer, file) {
  const base = String(pointer || "").replace(/^﻿/, "").trim().replace(/[\\/]+$/, "")
  return base ? base + "/" + file : null
}
function currentGreenfieldSlices(slicesText, designDirs) {
  const t = String(slicesText || "")
  if (!t.trim()) return []
  return (designDirs || []).filter((d) => {
    if (t.includes(d)) return true
    const slug = String(d).replace(/^slice-\d+-?/i, "")
    return slug.length > 0 && t.includes(slug)
  })
}
function planReadyForApproval(existsFn, { changeDir = null, choreDir = null, sliceDirs = [] } = {}) {
  if (existsFn(PLAN_REVIEW_MARK)) return true
  const cd = planPathUnder(changeDir, "PLAN.md")
  if (cd && existsFn(cd)) return true
  const chd = planPathUnder(choreDir, CHORE_PLAN_FILE)
  if (chd && existsFn(chd)) return true
  for (const s of sliceDirs || []) if (existsFn(DESIGN_DIR + "/" + s + "/PLAN.md")) return true
  return false
}
const ROLE_KEYS = ["subagent", "subagentType", "subagent_type", "agent", "agentType"]
function pickRole(args) {
  if (!args || typeof args !== "object") return "unknown"
  for (const k of ROLE_KEYS) if (typeof args[k] === "string") return args[k]
  return "unknown"
}
const normRole = (role) => String(role).toLowerCase().replace(/^@/, "").trim()
const isImplementer = (role) => IMPLEMENTERS.has(normRole(role))
const isRunCloser = (role) => RUN_CLOSERS.has(normRole(role))
const inPipeline = (role) => PIPELINE.has(normRole(role))
function writtenGateMarker(cmd) {
  for (const mark of GATE_MARKS) {
    const gm = mark.replace(/[.]/g, "\\.")
    if (new RegExp(`>>?\\s*['"]?[^\\s;|&'"]*${gm}`).test(cmd) ||
        new RegExp(`\\b(touch|tee|cp|mv|ln|install|dd)\\b[^;|&]*${gm}`).test(cmd)) return mark
  }
  return null
}
const writesGateMarker = (cmd) => writtenGateMarker(cmd) !== null
const gateMarkerInPath = (p) => GATE_MARKS.find((m) => String(p ?? "").includes(m)) ?? null
function doneGreenTicketId(cmd) {
  const doneWrite = />>?\s*['"]?[^\s;|&'"]*\.agent\/planner\/done\.log/.test(cmd)
  if (!doneWrite) return null
  const mk = /\bticket-0*(\d+)\b[^\n]*\bgreen\b/.exec(cmd)
  return mk ? mk[1] : null
}
function doneGreenWrite(cmd) {
  return />>?\s*['"]?[^\s;|&'"]*\.agent\/planner\/done\.log/.test(cmd) && /\bgreen\b/.test(String(cmd))
}
function parseTicketOutputs(text) {
  const m = /^outputs:\s*\[([^\]]*)\]/m.exec(text)
  if (!m) return []
  return m[1].split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean)
}
function choreOutputs(text) {
  const out = new Set(parseTicketOutputs(text))
  for (const m of String(text || "").matchAll(/`([^`\n]+)`/g)) {
    const t = m[1].trim()
    if (/^[\w./-]+$/.test(t) && (t.includes("/") || /\.[a-z0-9]+$/i.test(t))) out.add(t)
  }
  return [...out]
}
function isOperatorApproval(text) {
  return /\bgate1\s+approve\b/i.test(String(text))
}
function isGate2Approval(text) {
  return /\bgate2\s+approve\b/i.test(String(text))
}
const VCS_BRANCH_MARK = ".agent/vcs/branch"
function mergeReadyForApproval(existsFn) {
  return Boolean(existsFn(GATE_MARK) && existsFn(VCS_BRANCH_MARK))
}
function prRefFromText(text) {
  const s = String(text ?? "")
  const m = /https?:\/\/\S*?\/pull\/(\d+)/.exec(s) || /\b(?:pr\s*#?|#)(\d+)\b/i.exec(s)
  return m ? "pr-" + m[1] : "na"
}
function gateMarkerContent({ timestamp, source, prompt, planHash, ref }) {
  const one = (s) => String(s ?? "").replace(/[\t\r\n]+/g, " ").trim().slice(0, 500)
  const lines = [`approved_at\t${timestamp}`, `source\t${source}`]
  if (planHash !== undefined) lines.push(`plan_hash\t${planHash ?? "na"}`)
  if (ref !== undefined) lines.push(`ref\t${one(ref)}`)
  lines.push(`prompt\t${one(prompt)}`, "")
  return lines.join("\n")
}
function toolCallSignature(tool, args) {
  const norm = (v) => {
    if (Array.isArray(v)) return v.map(norm)
    if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, norm(v[k])]))
    return v
  }
  let a
  try { a = JSON.stringify(norm(args ?? {})) } catch { a = String(args) }
  return `${tool} ${a}`
}
function detectLoop(sigs, { runThreshold = 5, cycleRepeats = 3, maxPeriod = 3 } = {}) {
  const n = sigs.length
  if (n >= runThreshold && sigs.slice(n - runThreshold).every((s) => s === sigs[n - 1])) return sigs[n - 1]
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

// Текст выбора оператора из нативного меню opencode (event question.replied) — параллель chat.message-акцепту
// Gate #1. answers — вложенные массивы строк (лейблы опций); payload-ключ properties (v1) | data (v2). io: none.
function answerTextFromEvent(event) {
  const type = String(event?.type || "")
  if (!(type.includes("question") && type.includes("replied"))) return ""
  const body = event?.properties ?? event?.data ?? {}
  const out = []
  const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (typeof v === "string") out.push(v) }
  walk(body?.answers)
  return out.join(" ")
}

// ── ПЛАГИН ──────────────────────────────────────────────────────────────────────
// --hard enforcement для OpenCode: decisions.log на каждое делегирование + Gate #1 + фронтдор + on-trunk +
// poka-yoke outputs + anti-loop + watchdog (session.error). НИКАКОГО сетевого/блокирующего I/O на init.
export const RationalGuardrail = async ({ directory, worktree, client }) => {
  const pick = (...c) => c.find((p) => typeof p === "string" && p.length > 0 && p !== "/")
  const root = pick(worktree, directory) ?? process.cwd()

  const agentDir = join(root, ".agent")
  const logPath = join(agentDir, "decisions.log")
  const gate1 = join(agentDir, "gates", "gate1.approved")
  const gate2 = join(agentDir, "gates", "gate2.approved")
  const review = join(agentDir, "plan-reviewer", "plan-review.md")
  const brd = join(agentDir, "planner", "brd.md")

  const exists = async (p) => { try { await access(p); return true } catch { return false } }

  // Хеш снимка плана НА МОМЕНТ акцепта (аудит, паритет с claude gate-approve.mjs).
  const planHashSnapshot = async () => {
    try {
      const parts = []
      const designDir = join(root, DESIGN_DIR)
      const dirs = (await readdir(designDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort()
      for (const d of dirs) {
        try { parts.push(d + "\n" + await readFile(join(designDir, d, "PLAN.md"), "utf8")) } catch { /* нет */ }
        try {
          const changesRoot = join(designDir, d, "changes")
          for (const ch of (await readdir(changesRoot)).sort())
            try { parts.push(d + "/" + ch + "\n" + await readFile(join(changesRoot, ch, "PLAN.md"), "utf8")) } catch { /* нет */ }
        } catch { /* нет changes/ */ }
      }
      try {
        const choresDir = join(root, CHORES_DIR)
        for (const c of (await readdir(choresDir)).sort())
          try { parts.push("chore/" + c + "\n" + await readFile(join(choresDir, c, "CHORE-PLAN.md"), "utf8")) } catch { /* нет */ }
      } catch { /* нет docs/chores/ */ }
      try { parts.push("plan-review\n" + await readFile(join(root, PLAN_REVIEW_MARK), "utf8")) } catch { /* нет */ }
      return parts.length ? lightHash(parts.join("\n---\n"), 16) : "na"
    } catch { return "na" }
  }

  // watchdog (session.error → нудж) + anti-loop пороги из ЕДИНОГО источника (.opencode/rational.config.json).
  let NUDGE = "Провайдер оборвался — продолжи с текущего места, не переделывай"
  let NUDGE_COOLDOWN_MS = 30_000
  let LOOP_ON = true, LOOP_RUN = 5, LOOP_CYCLE = 3, LOOP_WINDOW = 16
  try {
    const wc = JSON.parse(await readFile(join(root, ".opencode", "rational.config.json"), "utf8"))
    if (typeof wc?.nudgeText === "string" && wc.nudgeText) NUDGE = wc.nudgeText
    if (Number.isFinite(wc?.nudgeCooldownMs)) NUDGE_COOLDOWN_MS = wc.nudgeCooldownMs
    if (typeof wc?.loopEnabled === "boolean") LOOP_ON = wc.loopEnabled
    if (Number.isFinite(wc?.loopRunThreshold)) LOOP_RUN = wc.loopRunThreshold
    if (Number.isFinite(wc?.loopCycleRepeats)) LOOP_CYCLE = wc.loopCycleRepeats
    if (Number.isFinite(wc?.loopWindow)) LOOP_WINDOW = wc.loopWindow
  } catch { /* нет конфига → дефолты */ }
  const loopSigs = []
  const lastNudge = new Map()
  const wakeIzi = async (sid) => {
    if (!client?.tui) return
    const now = Date.now()
    if (now - (lastNudge.get(sid) ?? 0) < NUDGE_COOLDOWN_MS) return
    lastNudge.set(sid, now)
    try {
      await client.tui.clearPrompt()
      await client.tui.appendPrompt({ body: { text: NUDGE } })
      await client.tui.submitPrompt()
    } catch { /* best-effort */ }
  }

  // poka-yoke (T03): по id тикета — объявленные `outputs`, которых нет/пусты. Ищем в slice/tickets/ И changes/*/tickets/.
  const missingOutputs = async (id) => {
    let text = null
    const rx = new RegExp(`^ticket-0*${id}\\.md$`)
    const ticketDirsOf = async (sliceDir) => {
      const dirs = [join(sliceDir, "tickets")]
      try { const cr = join(sliceDir, "changes"); for (const ch of await readdir(cr)) dirs.push(join(cr, ch, "tickets")) } catch { /* нет changes/ */ }
      return dirs
    }
    try {
      const designDir = join(root, "docs", "design")
      outer: for (const slice of await readdir(designDir)) {
        for (const tdir of await ticketDirsOf(join(designDir, slice))) {
          let files
          try { files = await readdir(tdir) } catch { continue }
          const hit = files.find((f) => rx.test(f))
          if (hit) { text = await readFile(join(tdir, hit), "utf8"); break outer }
        }
      }
    } catch { return [] }
    if (!text) return []
    const paths = parseTicketOutputs(text)
    const missing = []
    for (const p of paths) {
      try { const st = await stat(join(root, p)); if (st.isFile() && st.size === 0) missing.push(p) }
      catch { missing.push(p) }
    }
    return missing
  }

  // C3 poka-yoke (chore): у chore тикетов нет → берём объявленные файлы из <chore-dir>/CHORE-PLAN.md
  // (пойнтер, не глоб). Блок ТОЛЬКО когда файлы объявлены И НИ ОДНОГО реального (все отсутствуют/пусты) —
  // прозаичное извлечение консервативно: один настоящий выход = chore что-то произвёл. Нет плана/выходов
  // → null (fail-open). → { declared:[…] } к блоку | null.
  const choreGreenGap = async () => {
    let choreDir = ""
    try { choreDir = await readFile(join(root, CHORE_DIR_MARK), "utf8") } catch { return null }
    const rel = planPathUnder(choreDir, CHORE_PLAN_FILE)
    if (!rel) return null
    let text
    try { text = await readFile(join(root, rel), "utf8") } catch { return null }
    const declared = choreOutputs(text)
    if (!declared.length) return null
    for (const p of declared) {
      try { const st = await stat(join(root, p)); if (!(st.isFile() && st.size === 0)) return null } catch { /* нет файла */ }
    }
    return { declared }
  }

  // Фрейм трассировки: model + agents_rev + skillset_hash (считаем один раз на init, best-effort).
  const sha12 = (s) => lightHash(s, 12)
  let agentsRev = "na", skillsetHash = "na"
  const modelCache = new Map()
  const frameInit = (async () => {
    try { agentsRev = sha12(await readFile(join(root, "AGENTS.md"), "utf8")) } catch { /* нет */ }
    try {
      const skillsDir = join(root, ".opencode", "skills")
      const parts = []
      for (const n of (await readdir(skillsDir)).sort()) {
        try {
          const t = await readFile(join(skillsDir, n, "SKILL.md"), "utf8")
          const v = /^version:\s*["']?([^"'\n]+)/m.exec(t)?.[1]?.trim() ?? "?"
          parts.push(`${n}@${v}`)
        } catch { /* нет */ }
      }
      if (parts.length) skillsetHash = sha12(parts.join(","))
    } catch { /* нет */ }
  })()
  const resolveModel = async (role) => {
    if (modelCache.has(role)) return modelCache.get(role)
    let m = "na"
    try {
      const t = await readFile(join(root, ".opencode", "agent", role + ".md"), "utf8")
      m = /^model:\s*["']?([^"'\n]+)/m.exec(t)?.[1]?.trim() ?? "na"
    } catch { /* нет */ }
    modelCache.set(role, m)
    return m
  }

  const existsFn = (rel) => existsSync(join(root, rel))
  const readMaybe = (rel) => { try { return readFileSync(join(root, rel), "utf8") } catch { return "" } }
  const designDirsFn = () => { try { return readdirSync(join(root, DESIGN_DIR)) } catch { return [] } }
  // Готовность плана ТЕКУЩЕЙ задачи — по пойнтерам состояния (change-dir/chore-dir/slices.md), не глобом.
  // greenfield-срезы учитываем ТОЛЬКО в greenfield-полосе (иначе stale slices.md прошлого прогона, вне
  // текущего WIPE close-run, ложно подтвердил бы план в patch/chore).
  const planReadyNow = () => planReadyForApproval(existsFn, {
    changeDir: readMaybe(CHANGE_DIR_MARK),
    choreDir: readMaybe(CHORE_DIR_MARK),
    sliceDirs: readMaybe(MODE_MARK).replace(/^﻿/, "").trim() === "greenfield"
      ? currentGreenfieldSlices(readMaybe(SLICES_MARK), designDirsFn()) : [],
  })

  // Единый акцепт Gate #1 — из ДВУХ каналов: печатный токен в чате (chat.message) ИЛИ выбор пункта
  // нативного меню opencode (event question.replied). Одна идемпотентная запись маркера, одна защита
  // (план собран + маркер ещё не стоит). Оператор — только через плагин; izi маркер ставить НЕ может.
  const tryOperatorApproval = async (text, source) => {
    if (isOperatorApproval(text) && planReadyNow() && !(await exists(gate1))) {
      await mkdir(join(agentDir, "gates"), { recursive: true })
      await writeFile(gate1, gateMarkerContent({
        timestamp: new Date().toISOString(),
        source,
        prompt: text,
        planHash: await planHashSnapshot(),
      }))
    }
    // Gate #2 (мерж) — тот же контракт: явный токен «GATE2 APPROVE», маркер ставит ПЛАГИН, не агент.
    // Валиден только когда работа дошла до мержа (Gate #1 + ветка прогона). Provenance — PR-референс.
    if (isGate2Approval(text) && mergeReadyForApproval(existsFn) && !(await exists(gate2))) {
      await mkdir(join(agentDir, "gates"), { recursive: true })
      await writeFile(gate2, gateMarkerContent({
        timestamp: new Date().toISOString(),
        source,
        prompt: text,
        ref: prRefFromText(text),
      }))
    }
  }

  return {
    "tool.execute.before": async (input, output) => {
      const tool = input?.tool
      const args = output?.args ?? input?.args ?? {}

      // anti-loop: субагент застрял на повторе действия без прогресса → бросаем (dropout → izi эскалирует).
      if (LOOP_ON && tool && tool !== "task") {
        loopSigs.push(sha12(toolCallSignature(tool, args)))
        if (loopSigs.length > LOOP_WINDOW) loopSigs.shift()
        const hit = detectLoop(loopSigs, { runThreshold: LOOP_RUN, cycleRepeats: LOOP_CYCLE })
        if (hit) {
          loopSigs.length = 0
          throw new Error(
            "[rational-guardrail] anti-loop: субагент повторяет одно действие ('" + tool + "') без прогресса " +
            "(петля reasoning/tool без новых outputs). Действие заблокировано. Это DROPOUT — izi: genchi-genbutsu " +
            "(артефакт есть+build green? допиши маркер; нет — andon stop, retry ≤2 → @linger / split тикета). НЕ повторяй тот же шаг.",
          )
        }
      }

      // Маркер Gate #1 ставит ТОЛЬКО оператор вне сессии (не через bash/write/edit агента).
      if (tool === "bash") {
        const cmd = String(args.command ?? "")
        const mark = writtenGateMarker(cmd)
        if (mark) {
          throw new Error(
            "[rational-guardrail] Маркер Gate " + (mark.includes("gate2") ? "#2" : "#1") + " (" + mark + ") " +
            "ставит ТОЛЬКО оператор вне сессии. Создавать/писать его агенту запрещено — на гейте задай question и жди. " +
            "(Чтение-проверка `ls`/`test -f` разрешена.)",
          )
        }
        const greenId = doneGreenTicketId(cmd)
        if (greenId) {
          const miss = await missingOutputs(greenId)
          if (miss.length) {
            throw new Error(
              "[rational-guardrail] poka-yoke: ticket-" + greenId + " помечается `green`, но его объявленные " +
              "`outputs` отсутствуют/пусты: " + miss.join(", ") + ". Маркер НЕ записан — доведи артефакт(ы) до " +
              "непустого состояния или не пиши `green`. (Проверка существования, НЕ build.)",
            )
          }
        } else if (doneGreenWrite(cmd) && isChoreMode(readMaybe(MODE_MARK))) {
          const gap = await choreGreenGap()
          if (gap) {
            throw new Error(
              "[rational-guardrail] poka-yoke (chore): `green` в done.log, но НИ ОДИН объявленный в CHORE-PLAN.md " +
              "файл не существует/непуст: " + gap.declared.join(", ") + ". Маркер НЕ записан — доведи правку до " +
              "реального артефакта или не пиши `green`. (Проверка существования, НЕ build.)",
            )
          }
        }
      }
      if (tool === "write" || tool === "edit") {
        const p = String(args.filePath ?? args.path ?? "")
        const mark = gateMarkerInPath(p)
        if (mark)
          throw new Error("[rational-guardrail] Маркер Gate " + (mark.includes("gate2") ? "#2" : "#1") + " (" + mark + ") нельзя ставить через write/edit агента — только оператор вне сессии.")
      }

      if (tool !== "task") return
      const role = pickRole(output?.args ?? input?.args)

      // (1) Замкнутый набор ролей.
      if (role !== "unknown" && !PIPELINE.has(normRole(role))) {
        throw new Error(
          "[rational-guardrail] Делегация вне пайплайн-набора запрещена: '" + role + "'. " +
          "Роутить можно ТОЛЬКО фикс-роли (gilb/wirth-*/mills/scaffolder/hughes/wirth-tester/linger/fagan/michtom). " +
          "Неполный выход стадии → повтори ТУ ЖЕ стадию (≤2) или escalate. Авторство тикетов — @wirth-ticketer.",
        )
      }
      // (1.5) Фронтдор.
      if (role !== "unknown" && requiresFrontDoor(role) && !(await exists(brd))) {
        throw new Error(
          "[rational-guardrail] Фронтдор не пройден: пока нет .agent/planner/brd.md, ЕДИНственная " +
          "разрешённая делегация — @gilb (сырое BR → измеримый BRD + грил открытых вопросов). " +
          "Триаж/планирование/реализация заблокированы до этого. СНАЧАЛА делегируй @gilb.",
        )
      }
      // (1.6) Gate #2 — закрытие прогона (@ledger) только после акцепта мержа оператором.
      if (role !== "unknown" && isRunCloser(role) && !(await exists(gate2))) {
        throw new Error(
          "[rational-guardrail] Gate #2 не пройден: требуется акцепт мержа оператором (.agent/gates/" +
          "gate2.approved, токен «GATE2 APPROVE») перед делегированием закрытия прогона (" + role + "). " +
          "Маркер ставит плагин, НЕ ты — покажи зелёный PR и жди.",
        )
      }
      // (1.7) On-trunk poka-yoke.
      if (role !== "unknown" && isImplementer(role)) {
        try {
          const branch = branchFromHead(await readFile(join(root, ".git", "HEAD"), "utf8"))
          if (branch && isTrunkBranch(branch)) {
            throw new Error(
              "[rational-guardrail] Старт на транке запрещён: HEAD на '" + branch + "'. Реализатор (" + role +
              ") работает ТОЛЬКО на рабочей ветке. Сначала делегируй @git-hand mode=start — свежий транк + ветка <type>/<slug> (git-conventions).",
            )
          }
        } catch (e) {
          if (e instanceof Error && e.message.startsWith("[rational-guardrail]")) throw e
          // нет .git/HEAD / detached → fail-open
        }
      }

      if (!isImplementer(role)) return
      // Gate #1: под mode=chore — durable CHORE-PLAN.md; иначе plan-review.md. + апрув оператора.
      let mode = ""
      try { mode = await readFile(join(agentDir, "planner", "mode"), "utf8") } catch { /* нет маркера */ }
      if (isChoreMode(mode)) {
        // План ТЕКУЩЕГО chore — по пойнтеру chore-dir (не глоб docs/chores/*: durable-план прошлой задачи не в счёт).
        const chorePlan = planPathUnder(readMaybe(CHORE_DIR_MARK), CHORE_PLAN_FILE)
        if (!chorePlan || !existsFn(chorePlan) || !(await exists(gate1)))
          throw new Error(
            "[rational-guardrail] Gate #1 (chore) не пройден: требуется durable план <chore-dir>/CHORE-PLAN.md " +
            "(пойнтер .agent/planner/chore-dir) и апрув оператора (.agent/gates/gate1.approved) перед делегированием реализации (" + role + ").",
          )
        return
      }
      if (!(await exists(review)) || !(await exists(gate1)))
        throw new Error(
          "[rational-guardrail] Gate #1 не пройден: требуется .agent/plan-reviewer/plan-review.md и апрув оператора " +
          "(.agent/gates/gate1.approved) перед делегированием реализации (hughes/wirth-tester).",
        )
    },

    // Gate #1 акцепт (канал 1): оператор ПЕЧАТАЕТ токен «GATE1 APPROVE» в чат → плагин ставит маркер (если план собран).
    "chat.message": async (_input, output) => {
      try {
        const parts = output?.parts ?? []
        const text = parts.filter((p) => p?.type === "text").map((p) => String(p.text ?? "")).join(" ")
        await tryOperatorApproval(text, "operator-approval-via-chat")
      } catch { /* best-effort */ }
    },

    // Гарантированный decisions.log на каждое делегирование роли.
    "tool.execute.after": async (input, output) => {
      if (input?.tool !== "task") return
      try {
        await mkdir(join(agentDir, "gates"), { recursive: true })
        const role = pickRole(input?.args)
        const ts = new Date().toISOString()
        const title = String(output?.title ?? output?.metadata?.title ?? "").slice(0, 120)
        await frameInit
        const model = await resolveModel(role)
        await appendFile(logPath, `${ts}\trole=${role}\tmodel=${model}\tagents_rev=${agentsRev}\tskillset_hash=${skillsetHash}\tvia=opencode-plugin\t${title}\n`)
      } catch { /* аудит best-effort */ }
    },

    // event-канал: (a) Gate #1 акцепт (канал 2) — выбор пункта нативного меню opencode (question.replied);
    // (b) session.error → нативно будим izi (замена tmux-сторожа, дебаунс по сессии).
    event: async ({ event }) => {
      const type = String(event?.type || "")
      if (type.includes("question") && type.includes("replied")) {
        try { await tryOperatorApproval(answerTextFromEvent(event), "operator-approval-via-menu") } catch { /* best-effort */ }
        return
      }
      if (type !== "session.error") return
      const p = event?.properties ?? {}
      const sid = String(p.sessionID ?? p.info?.id ?? p.error?.data?.sessionID ?? "global")
      await wakeIzi(sid)
    },
  }
}
