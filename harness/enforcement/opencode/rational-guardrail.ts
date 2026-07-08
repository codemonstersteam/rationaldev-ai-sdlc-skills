import type { Plugin } from "@opencode-ai/plugin"
import { appendFile, writeFile, mkdir, access, readFile, readdir, stat } from "node:fs/promises"
import { createHash } from "node:crypto"
import { join } from "node:path"

// --hard enforcement для OpenCode. Делает ПРИНУДИТЕЛЬНЫМ то, что промпты рекомендуют:
//   1) decisions.log — пишется на каждое делегирование роли (аудит), без участия агента;
//   2) Gate #1 — нельзя делегировать implementer без ревью плана и апрува оператора.

const ROLE_KEYS = ["subagent", "subagentType", "subagent_type", "agent", "agentType"]

// Замкнутый набор пайплайн-ролей. Делегация `task` кому-либо вне набора (@general и пр.) —
// мис-роутинг: izi должен повторить ТУ ЖЕ стадию или escalate, а не выдумывать агента.
const PIPELINE = new Set([
  "izi", "wirth-triage", "wirth-intake", "wirth-slicer", "wirth-usecase", "wirth-apidesigner",
  "wirth-moduledesigner", "wirth-ticketer", "wirth-planner", "mills",
  "scaffolder", "hughes", "wirth-tester", "linger", "fagan", "michtom",
])

function pickRole(args: unknown): string {
  if (!args || typeof args !== "object") return "unknown"
  const a = args as Record<string, unknown>
  for (const k of ROLE_KEYS) if (typeof a[k] === "string") return a[k] as string
  return "unknown"
}

export const RationalGuardrail: Plugin = async ({ directory, worktree, client }: any) => {
  // Резолв корня проекта: пропускаем "/" (под headless `opencode run` directory/worktree
  // может быть "/" — read-only → EROFS и ложная блокировка) и пустые; фоллбэк на
  // process.cwd() (каталог запуска opencode = каталог проекта).
  const pick = (...c: unknown[]) =>
    c.find((p): p is string => typeof p === "string" && p.length > 0 && p !== "/")
  const root = pick(worktree, directory) ?? process.cwd()
  const agentDir = join(root, ".agent")
  const logPath = join(agentDir, "decisions.log")
  const gate1 = join(agentDir, "gates", "gate1.approved")
  const review = join(agentDir, "plan-reviewer", "plan-review.md")

  const exists = async (p: string) => {
    try { await access(p); return true } catch { return false }
  }

  // (T09b) 504/сеть-resilience В ПЛАГИНЕ (замена tmux-сайдкара): на session.error (провайдер оборвался/
  // таймаут/тихий hang — последний ловится, если в конфиге выставлен chunkTimeout/timeout) — нативно будим izi:
  // clearPrompt (сбрасывает залипший QUEUED-ввод — дыра сайдкара) → appendPrompt(нудж) → submitPrompt.
  // Дебаунс ПО СЕССИИ (не глобальный cooldown — иначе новый тикет/сессия глохнет, как ловили на 07-07/3).
  // watchdog-настройки из ЕДИНОГО источника (models.config.json → install кладёт .opencode/rational.config.json).
  // Нет файла → дефолты. OpenCode их не знает — потому отдельный plugin-конфиг, не opencode.jsonc.
  let NUDGE = "Провайдер оборвался — продолжи с текущего места, не переделывай"
  let NUDGE_COOLDOWN_MS = 30_000
  try {
    const wc = JSON.parse(await readFile(join(root, ".opencode", "rational.config.json"), "utf8"))
    if (typeof wc?.nudgeText === "string" && wc.nudgeText) NUDGE = wc.nudgeText
    if (Number.isFinite(wc?.nudgeCooldownMs)) NUDGE_COOLDOWN_MS = wc.nudgeCooldownMs
  } catch { /* нет конфига → дефолты */ }
  const lastNudge = new Map<string, number>()
  const wakeIzi = async (sid: string) => {
    if (!client?.tui) return // headless / нет TUI — тихо
    const now = Date.now()
    if (now - (lastNudge.get(sid) ?? 0) < NUDGE_COOLDOWN_MS) return
    lastNudge.set(sid, now)
    try {
      await client.tui.clearPrompt()
      await client.tui.appendPrompt({ body: { text: NUDGE } })
      await client.tui.submitPrompt()
    } catch { /* best-effort: TUI недоступен */ }
  }

  // poka-yoke (T03): по id тикета вернуть его объявленные `outputs`, которых НЕТ или которые пусты.
  // Тикет ищем в docs/design/*/tickets/ticket-<id>.md; `outputs` парсим regex'ом (flow-массив [a, b]).
  // Тикет/outputs не нашли → [] (НЕ блокируем: ложный blocker роняет прогон; заголовок ловит validate-tickets).
  const missingOutputs = async (id: string): Promise<string[]> => {
    let text: string | null = null
    try {
      const designDir = join(root, "docs", "design")
      for (const slice of await readdir(designDir)) {
        const tdir = join(designDir, slice, "tickets")
        let files: string[]
        try { files = await readdir(tdir) } catch { continue }
        const hit = files.find((f) => new RegExp(`^ticket-0*${id}\\.md$`).test(f))
        if (hit) { text = await readFile(join(tdir, hit), "utf8"); break }
      }
    } catch { return [] }
    if (!text) return []
    const m = /^outputs:\s*\[([^\]]*)\]/m.exec(text)
    if (!m) return []
    const paths = m[1].split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean)
    const missing: string[] = []
    for (const p of paths) {
      try { const st = await stat(join(root, p)); if (st.isFile() && st.size === 0) missing.push(p) }
      catch { missing.push(p) }
    }
    return missing
  }

  // Фрейм трассировки (docs/02_MEASUREMENT.md §«что фиксируем»): model + agents_rev + skillset_hash
  // на каждое агентское действие. Считаем ОДИН раз на init (best-effort), кэшируем модель по роли.
  const sha12 = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 12)
  let agentsRev = "na"
  let skillsetHash = "na"
  const modelCache = new Map<string, string>()
  const frameInit = (async () => {
    try { agentsRev = sha12(await readFile(join(root, "AGENTS.md"), "utf8")) } catch {}
    try {
      const skillsDir = join(root, ".opencode", "skills")
      const parts: string[] = []
      for (const n of (await readdir(skillsDir)).sort()) {
        try {
          const t = await readFile(join(skillsDir, n, "SKILL.md"), "utf8")
          const v = /^version:\s*["']?([^"'\n]+)/m.exec(t)?.[1]?.trim() ?? "?"
          parts.push(`${n}@${v}`)
        } catch {}
      }
      if (parts.length) skillsetHash = sha12(parts.join(","))
    } catch {}
  })()
  const resolveModel = async (role: string): Promise<string> => {
    if (modelCache.has(role)) return modelCache.get(role)!
    let m = "na"
    try {
      const t = await readFile(join(root, ".opencode", "agent", role + ".md"), "utf8")
      m = /^model:\s*["']?([^"'\n]+)/m.exec(t)?.[1]?.trim() ?? "na"
    } catch {}
    modelCache.set(role, m)
    return m
  }

  // Строка, по которой ловим попытку агента создать/тронуть маркер Gate #1.
  const GATE_MARK = ".agent/gates/gate1.approved"

  return {
    // Gate #1: жёсткий стоп на делегировании implementer до апрува плана.
    "tool.execute.before": async (input: any, output: any) => {
      const tool = input?.tool
      const args = output?.args ?? input?.args ?? {}

      // (0) Маркер Gate #1 ставит ТОЛЬКО оператор вне сессии. Агент не может его
      // создавать/трогать — иначе human-gate обходится самоакцептом (найдено на dry-run).
      if (tool === "bash") {
        const cmd = String((args as any).command ?? "")
        // Блокируем только СОЗДАНИЕ/ЗАПИСЬ маркера (редирект >/>> или touch/tee/cp/mv/ln/install/dd),
        // но НЕ чтение-верификацию (ls/test/cat/stat) — izi ДОЛЖЕН мочь проверить маркер (см. izi.md).
        const gm = GATE_MARK.replace(/[.]/g, "\\.")
        const writesMarker =
          new RegExp(`>>?\\s*['\"]?[^\\s;|&'\"]*${gm}`).test(cmd) ||
          new RegExp(`\\b(touch|tee|cp|mv|ln|install|dd)\\b[^;|&]*${gm}`).test(cmd)
        if (writesMarker) {
          throw new Error(
            "[rational-guardrail] Маркер Gate #1 (" + GATE_MARK + ") ставит ТОЛЬКО оператор " +
            "вне сессии. Создавать/писать его агенту запрещено — на Gate #1 задай question и жди. " +
            "(Чтение-проверка `ls`/`test -f` разрешена.)",
          )
        }

        // (0b) poka-yoke: маркер готовности `ticket-NN <slice> green` в done.log принимается ТОЛЬКО если
        // объявленные в заголовке тикета `outputs` реально существуют и непусты. Ловит «зелёный без
        // артефакта» на записи маркера (дёшево), а не на приёмке (@linger, дорого). run08: /health опущен.
        const doneWrite = />>?\s*['"]?[^\s;|&'"]*\.agent\/planner\/done\.log/.test(cmd)
        const mk = /\bticket-0*(\d+)\b[^\n]*\bgreen\b/.exec(cmd)
        if (doneWrite && mk) {
          const miss = await missingOutputs(mk[1])
          if (miss.length) {
            throw new Error(
              "[rational-guardrail] poka-yoke: ticket-" + mk[1] + " помечается `green`, но его объявленные " +
              "`outputs` отсутствуют/пусты: " + miss.join(", ") + ". Маркер НЕ записан — доведи артефакт(ы) до " +
              "непустого состояния или не пиши `green`. (Проверка существования, НЕ build.)",
            )
          }
        }
      }
      if (tool === "write" || tool === "edit") {
        const p = String((args as any).filePath ?? (args as any).path ?? "")
        if (p.includes(GATE_MARK)) {
          throw new Error(
            "[rational-guardrail] Маркер Gate #1 (" + GATE_MARK + ") нельзя ставить через write/edit " +
            "агента — только оператор вне сессии.",
          )
        }
      }

      if (tool !== "task") return
      const role = pickRole(output?.args ?? input?.args)

      // (1) Замкнутый набор: делегация вне пайплайн-ролей запрещена (ловит @general/мис-роут в источнике).
      // "unknown" (роль не резолвится из args) — НЕ блокируем, чтобы не давать ложных срабатываний.
      if (role !== "unknown") {
        const r = role.toLowerCase().replace(/^@/, "").trim()
        if (!PIPELINE.has(r)) {
          throw new Error(
            "[rational-guardrail] Делегация вне пайплайн-набора запрещена: '" + role + "'. " +
            "Роутить можно ТОЛЬКО фикс-роли (wirth-*/mills/scaffolder/hughes/wirth-tester/linger/fagan/michtom). " +
            "Неполный выход стадии → повтори ТУ ЖЕ стадию (≤2) или escalate. " +
            "Авторство тикетов — исключительно @wirth-ticketer, НЕ @hughes/@general.",
          )
        }
      }

      // Реализация (scaffolder/hughes) и автор компонентных тестов (wirth-tester) заблокированы до Gate #1.
      if (role !== "hughes" && role !== "wirth-tester" && role !== "scaffolder") return
      if (!(await exists(review)) || !(await exists(gate1))) {
        throw new Error(
          "[rational-guardrail] Gate #1 не пройден: требуется " +
          ".agent/plan-reviewer/plan-review.md и апрув оператора " +
          "(.agent/gates/gate1.approved) перед делегированием реализации (hughes/wirth-tester).",
        )
      }
    },

    // Gate #1 акцепт БЕЗ touch: оператор пишет «акцепт» в чат → плагин ставит маркер.
    // Это сообщение ОПЕРАТОРА (role=user), агент его подделать не может; сам маркер агенту
    // по-прежнему запрещён (tool.execute.before выше). Реализует «флоу от команды оператора».
    "chat.message": async (_input: any, output: any) => {
      try {
        const parts: any[] = output?.parts ?? []
        const text = parts
          .filter((p) => p?.type === "text")
          .map((p) => String(p.text ?? ""))
          .join(" ")
          .toLowerCase()
        if (/(^|[\s.,!])(акцепт|акцептую|approve|принял план|gate1[- ]?ok|go ahead)([\s.,!]|$)/.test(text)) {
          await mkdir(join(agentDir, "gates"), { recursive: true })
          await writeFile(gate1, new Date().toISOString() + "\toperator-approval-via-chat\n")
        }
      } catch {
        // best-effort: сбой записи не валит сессию
      }
    },

    // Гарантированный decisions.log: каждое завершённое делегирование роли.
    "tool.execute.after": async (input: any, output: any) => {
      if (input?.tool !== "task") return
      try {
        await mkdir(join(agentDir, "gates"), { recursive: true })
        const role = pickRole(input?.args)
        const ts = new Date().toISOString()
        const title = String(output?.title ?? output?.metadata?.title ?? "").slice(0, 120)
        await frameInit
        const model = await resolveModel(role)
        await appendFile(logPath, `${ts}\trole=${role}\tmodel=${model}\tagents_rev=${agentsRev}\tskillset_hash=${skillsetHash}\tvia=opencode-plugin\t${title}\n`)
      } catch {
        // Аудит best-effort: сбой записи (например EROFS) НЕ валит делегирование.
      }
    },

    // (T09b) session.error → нативно будим izi (замена tmux-сторожа watch-izi-resume.sh). Триггер по
    // ошибке сессии (провайдер оборвался / таймаут / тихий hang — если в конфиге выставлен chunkTimeout).
    // Дебаунс по сессии; впрыск через client.tui (clearPrompt+append+submit) — не tmux → нет QUEUED.
    event: async ({ event }: any) => {
      if (event?.type !== "session.error") return
      const p = event?.properties ?? {}
      const sid = String(p.sessionID ?? p.info?.id ?? p.error?.data?.sessionID ?? "global")
      await wakeIzi(sid)
    },
  }
}
