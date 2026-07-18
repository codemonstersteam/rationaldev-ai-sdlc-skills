#!/usr/bin/env node
// Claude Code PreToolUse-хук на инструмент Task. Кросс-платформенный (Node, без POSIX-утилит).
// Enforce-ит две вещи (общая логика — ../shared.mjs, ЕДИНый источник с opencode-плагином):
//   1) closed-set: делегация роли ВНЕ пайплайн-набора (@general/мис-роут) → блок;
//   2) Gate #1: делегация реализатора (hughes/wirth-tester/scaffolder) без plan-review.md + gate1.approved → блок.
// Вход: JSON на stdin (tool_input{subagent_type,…}). Выход: exit 2 → Claude блокирует вызов, показывает stderr.
// Fail-open: любая инфра-ошибка НЕ рубит делегацию (иначе агент не сохранит даже план).
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { readdirSync } from "node:fs"
import { pickRole, inPipeline, isImplementer, normRole, requiresFrontDoor, branchFromHead, isTrunkBranch, isChoreMode, hasChorePlan, CHORES_DIR, isForeignMode, hasForeignPlan, FOREIGN_DIR } from "../shared.mjs"

async function readStdin() {
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  return Buffer.concat(chunks).toString("utf8")
}
const block = (msg) => { process.stderr.write("[rational-guardrail] " + msg + "\n"); process.exit(2) }

try {
  const raw = await readStdin()
  let input = {}
  try { input = JSON.parse(raw) } catch { process.exit(0) } // не наш формат → не мешаем
  const ti = input?.tool_input ?? input?.toolInput ?? input?.args ?? {}
  const role = pickRole(ti)
  if (role === "unknown") process.exit(0) // роль не резолвится → без ложных срабатываний

  // (1) closed-set — роутить можно ТОЛЬКО пайплайн-роли.
  if (!inPipeline(role)) {
    block(
      "Делегация вне пайплайн-набора запрещена: '" + role + "'. Роутить можно ТОЛЬКО фикс-роли " +
      "(gilb/wirth-*/mills/scaffolder/hughes/wirth-tester/linger/fagan/michtom). Неполный выход стадии → " +
      "повтори ТУ ЖЕ стадию (≤2) или escalate. Авторство тикетов — исключительно @wirth-ticketer.",
    )
  }

  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()

  // (1.5) Фронтдор — пока нет brd.md, роутить можно ТОЛЬКО @gilb (poka-yoke, не проза).
  if (requiresFrontDoor(role) && !existsSync(join(root, ".agent", "planner", "brd.md"))) {
    block(
      "Фронтдор не пройден: пока нет .agent/planner/brd.md, ЕДИНственная разрешённая делегация — @gilb " +
      "(сырое BR → измеримый BRD + грил открытых вопросов). Триаж/планирование/реализация заблокированы " +
      "до этого. Ты ушёл в '" + normRole(role) + "' в обход грила — СНАЧАЛА делегируй @gilb.",
    )
  }

  // (1.7) On-trunk poka-yoke — реализатор НЕ работает на транке. Сначала @git-hand mode=start режет ветку
  // от свежего транка; пока HEAD на main/master/trunk — реализация заблокирована. @git-hand не реализатор.
  if (isImplementer(role)) {
    try {
      const branch = branchFromHead(readFileSync(join(root, ".git", "HEAD"), "utf8"))
      if (branch && isTrunkBranch(branch)) {
        block(
          "Старт на транке запрещён: HEAD на '" + branch + "'. Реализатор (" + normRole(role) + ") работает " +
          "ТОЛЬКО на рабочей ветке. Сначала делегируй @git-hand mode=start — он подтянет свежий транк и отрежет " +
          "ветку <type>/<slug> (правило старта работы, git-conventions).",
        )
      }
    } catch { /* нет .git/HEAD или detached → не блокируем (fail-open) */ }
  }

  // (2) Gate #1 — реализаторы заблокированы до апрува плана. Под mode=chore план — одностраничный
  // CHORE-PLAN.md (полного plan-review.md нет), поэтому требуем его вместо ревью (gate1.approved — всегда).
  if (!isImplementer(role)) process.exit(0)
  const gate1 = join(root, ".agent", "gates", "gate1.approved")
  let mode = ""
  try { mode = readFileSync(join(root, ".agent", "planner", "mode"), "utf8") } catch { /* нет маркера */ }
  if (isChoreMode(mode)) {
    const existsFn = (rel) => existsSync(join(root, rel))
    const choreDirsFn = () => { try { return readdirSync(join(root, CHORES_DIR)) } catch { return [] } }
    if (!hasChorePlan(choreDirsFn, existsFn) || !existsSync(gate1)) {
      block(
        "Gate #1 (chore) не пройден: нужны durable план docs/chores/<slug>/CHORE-PLAN.md и .agent/gates/gate1.approved " +
        "перед делегированием реализации (" + normRole(role) + ").",
      )
    }
    process.exit(0)
  }
  if (isForeignMode(mode)) {
    const existsFn = (rel) => existsSync(join(root, rel))
    const foreignDirsFn = () => { try { return readdirSync(join(root, FOREIGN_DIR)) } catch { return [] } }
    if (!hasForeignPlan(foreignDirsFn, existsFn) || !existsSync(gate1)) {
      block(
        "Gate #1 (foreign) не пройден: нужны durable план docs/foreign/<slug>/FOREIGN-PLAN.md и .agent/gates/gate1.approved " +
        "перед делегированием реализации (" + normRole(role) + ").",
      )
    }
    process.exit(0)
  }
  const review = join(root, ".agent", "plan-reviewer", "plan-review.md")
  if (!existsSync(review) || !existsSync(gate1)) {
    block(
      "Gate #1 не пройден: нужны .agent/plan-reviewer/plan-review.md и .agent/gates/gate1.approved " +
      "перед делегированием реализации (" + normRole(role) + ").",
    )
  }
  process.exit(0)
} catch {
  process.exit(0) // fail-open: инфра-сбой хука не блокирует работу агента
}
