import type { Plugin } from "@opencode-ai/plugin"
import { appendFile, writeFile, mkdir, access, readFile, readdir, stat } from "node:fs/promises"
import { existsSync, readdirSync } from "node:fs"
import { createHash } from "node:crypto"
import { join } from "node:path"
// ЕДИНЫЙ источник enforcement-логики (общий с claude-хуками) — не расходиться.
import {
  PIPELINE, GATE_MARK, pickRole, inPipeline, writesGateMarker, doneGreenTicketId, requiresFrontDoor,
  parseTicketOutputs, isOperatorApproval, planReadyForApproval, gateMarkerContent, DESIGN_DIR, PLAN_REVIEW_MARK,
  isImplementer, branchFromHead, isTrunkBranch, toolCallSignature, detectLoop,
} from "../shared.mjs"

// --hard enforcement для OpenCode. Делает ПРИНУДИТЕЛЬНЫМ то, что промпты рекомендуют:
//   1) decisions.log — пишется на каждое делегирование роли (аудит), без участия агента;
//   2) Gate #1 — нельзя делегировать implementer без ревью плана и апрува оператора.

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
  const brd = join(agentDir, "planner", "brd.md")

  const exists = async (p: string) => {
    try { await access(p); return true } catch { return false }
  }

  // Хеш снимка плана НА МОМЕНТ акцепта (аудит, паритет с claude gate-approve.mjs):
  // все docs/design/*/PLAN.md (sorted) + plan-review.md. best-effort → "na".
  const planHashSnapshot = async (): Promise<string> => {
    try {
      const parts: string[] = []
      const designDir = join(root, DESIGN_DIR)
      const dirs = (await readdir(designDir, { withFileTypes: true }))
        .filter((e: any) => e.isDirectory()).map((e: any) => e.name).sort()
      for (const d of dirs) {
        try { parts.push(d + "\n" + await readFile(join(designDir, d, "PLAN.md"), "utf8")) } catch { /* нет PLAN.md */ }
      }
      try { parts.push("plan-review\n" + await readFile(join(root, PLAN_REVIEW_MARK), "utf8")) } catch { /* нет ревью */ }
      return parts.length ? createHash("sha256").update(parts.join("\n---\n")).digest("hex").slice(0, 16) : "na"
    } catch { return "na" }
  }

  // (T09b) 504/сеть-resilience В ПЛАГИНЕ (замена tmux-сайдкара): на session.error (провайдер оборвался/
  // таймаут/тихий hang — последний ловится, если в конфиге выставлен chunkTimeout/timeout) — нативно будим izi:
  // clearPrompt (сбрасывает залипший QUEUED-ввод — дыра сайдкара) → appendPrompt(нудж) → submitPrompt.
  // Дебаунс ПО СЕССИИ (не глобальный cooldown — иначе новый тикет/сессия глохнет, как ловили на 07-07/3).
  // watchdog-настройки из ЕДИНОГО источника (models.config.json → install кладёт .opencode/rational.config.json).
  // Нет файла → дефолты. OpenCode их не знает — потому отдельный plugin-конфиг, не opencode.jsonc.
  let NUDGE = "Провайдер оборвался — продолжи с текущего места, не переделывай"
  let NUDGE_COOLDOWN_MS = 30_000
  // anti-loop: детект застревания субагента на повторе действия без прогресса (из того же plugin-конфига).
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
  const loopSigs: string[] = [] // кольцевой буфер сигнатур tool-call'ов (инстанс = сессия)
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
    const paths = parseTicketOutputs(text)
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

  return {
    // Gate #1: жёсткий стоп на делегировании implementer до апрува плана.
    "tool.execute.before": async (input: any, output: any) => {
      const tool = input?.tool
      const args = output?.args ?? input?.args ?? {}

      // (L) anti-loop: субагент застрял на повторе ОДНОГО действия без прогресса (петля reasoning/tool
      // без новых outputs — hughes/Qwen на конфликте типа, 17-07). Трекаем сигнатуры всех tool-call'ов
      // кроме `task` (делегации гейтятся отдельно). Детект → бросаем: турн падает как dropout, izi
      // эскалирует по genchi-genbutsu (T04). Сброс буфера после броска — не долбить каждый следующий вызов.
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

      // (0) Маркер Gate #1 ставит ТОЛЬКО оператор вне сессии. Агент не может его
      // создавать/трогать — иначе human-gate обходится самоакцептом (найдено на dry-run).
      if (tool === "bash") {
        const cmd = String((args as any).command ?? "")
        // Блокируем только СОЗДАНИЕ/ЗАПИСЬ маркера (редирект >/>> или touch/tee/cp/mv/ln/install/dd),
        // но НЕ чтение-верификацию (ls/test/cat/stat) — izi ДОЛЖЕН мочь проверить маркер (см. izi.md).
        if (writesGateMarker(cmd)) {
          throw new Error(
            "[rational-guardrail] Маркер Gate #1 (" + GATE_MARK + ") ставит ТОЛЬКО оператор " +
            "вне сессии. Создавать/писать его агенту запрещено — на Gate #1 задай question и жди. " +
            "(Чтение-проверка `ls`/`test -f` разрешена.)",
          )
        }

        // (0b) poka-yoke: маркер готовности `ticket-NN <slice> green` в done.log принимается ТОЛЬКО если
        // объявленные в заголовке тикета `outputs` реально существуют и непусты. Ловит «зелёный без
        // артефакта» на записи маркера (дёшево), а не на приёмке (@linger, дорого). run08: /health опущен.
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
            "Роутить можно ТОЛЬКО фикс-роли (gilb/wirth-*/mills/scaffolder/hughes/wirth-tester/linger/fagan/michtom). " +
            "Неполный выход стадии → повтори ТУ ЖЕ стадию (≤2) или escalate. " +
            "Авторство тикетов — исключительно @wirth-ticketer, НЕ @hughes/@general.",
          )
        }
      }

      // (1.5) Фронтдор (poka-yoke): пока нет brd.md, роутить можно ТОЛЬКО @gilb. Проза в izi.md не держит.
      if (role !== "unknown" && requiresFrontDoor(role) && !(await exists(brd))) {
        throw new Error(
          "[rational-guardrail] Фронтдор не пройден: пока нет .agent/planner/brd.md, ЕДИНственная " +
          "разрешённая делегация — @gilb (сырое BR → измеримый BRD + грил открытых вопросов). " +
          "Триаж/планирование/реализация заблокированы до этого. СНАЧАЛА делегируй @gilb.",
        )
      }

      // (1.7) On-trunk poka-yoke: реализатор НЕ работает на транке — сначала @git-hand mode=start режет ветку
      // от свежего транка (правило старта работы). @git-hand не реализатор → не блокируется (он-то ветку и режет).
      if (role !== "unknown" && isImplementer(role)) {
        try {
          const branch = branchFromHead(await readFile(join(root, ".git", "HEAD"), "utf8"))
          if (branch && isTrunkBranch(branch)) {
            throw new Error(
              "[rational-guardrail] Старт на транке запрещён: HEAD на '" + branch + "'. Реализатор (" + role +
              ") работает ТОЛЬКО на рабочей ветке. Сначала делегируй @git-hand mode=start — свежий транк + ветка " +
              "<type>/<slug> (git-conventions).",
            )
          }
        } catch (e: any) {
          if (e instanceof Error && e.message.startsWith("[rational-guardrail]")) throw e
          // нет .git/HEAD или detached-HEAD → fail-open (не блокируем)
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

    // Gate #1 акцепт БЕЗ touch: оператор пишет явный ТОКЕН «GATE1 APPROVE» в чат → плагин ставит маркер.
    // Свободные «go ahead / approve / акцепт» больше НЕ согласие (ложно ставили гейт по случайной фразе).
    // Это сообщение ОПЕРАТОРА (role=user), агент его подделать не может; сам маркер агенту
    // по-прежнему запрещён (tool.execute.before выше). Реализует «флоу от команды оператора».
    "chat.message": async (_input: any, output: any) => {
      try {
        const parts: any[] = output?.parts ?? []
        const text = parts
          .filter((p) => p?.type === "text")
          .map((p) => String(p.text ?? ""))
          .join(" ")
        if (isOperatorApproval(text)) {
          // Акцепт валиден ТОЛЬКО когда план собран (PLAN.md/plan-review.md) — иначе раннее «go ahead»
          // ложно ставит маркер и обнуляет человеческий Gate #1. Нет плана → игнорируем.
          const existsFn = (rel: string) => existsSync(join(root, rel))
          const sliceDirsFn = () => { try { return readdirSync(join(root, DESIGN_DIR)) } catch { return [] } }
          if (!planReadyForApproval(existsFn, sliceDirsFn)) return
          if (await exists(gate1)) return                   // первый акцепт фиксируется, повтор не клобберит
          await mkdir(join(agentDir, "gates"), { recursive: true })
          await writeFile(gate1, gateMarkerContent({
            timestamp: new Date().toISOString(),
            source: "operator-approval-via-chat",
            prompt: text,
            planHash: await planHashSnapshot(),
          }))
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
