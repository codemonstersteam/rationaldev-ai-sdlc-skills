#!/usr/bin/env node
// Claude Code UserPromptSubmit-хук — паритет с opencode chat.message. Ловит «акцепт/approve/go ahead»
// в промпте ОПЕРАТОРА → ставит .agent/gates/gate1.approved (акцепт Gate #1 из чата, без ручного touch).
// Это сообщение оператора (не агента) — агенту self-accept по-прежнему запрещён (gate-bash). Общая
// логика распознавания — ../shared.mjs (isOperatorApproval), единая с плагином.
// Вход: JSON на stdin ({prompt,…}). Выход: exit 0 (промпт НЕ блокируем). Fail-open на любой ошибке.
import { existsSync, mkdirSync, writeFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { isOperatorApproval, planReadyForApproval, DESIGN_DIR } from "../shared.mjs"

async function readStdin() {
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  return Buffer.concat(chunks).toString("utf8")
}

try {
  const raw = await readStdin()
  let input = {}
  try { input = JSON.parse(raw) } catch { process.exit(0) }
  const prompt = String(input?.prompt ?? input?.user_prompt ?? input?.message ?? "")
  if (!isOperatorApproval(prompt)) process.exit(0)

  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()

  // Акцепт валиден ТОЛЬКО когда план СОБРАН (есть PLAN.md/plan-review.md) — иначе «go ahead» на
  // ранней фазе ложно ставит маркер и обнуляет человеческий Gate #1. Нет плана → игнорируем акцепт.
  const existsFn = (rel) => existsSync(join(root, rel))
  const sliceDirsFn = () => { try { return readdirSync(join(root, DESIGN_DIR)) } catch { return [] } }
  if (!planReadyForApproval(existsFn, sliceDirsFn)) process.exit(0)

  const gatesDir = join(root, ".agent", "gates")
  const marker = join(gatesDir, "gate1.approved")
  if (!existsSync(marker)) {                       // первый акцепт фиксируется, повтор не клобберит
    mkdirSync(gatesDir, { recursive: true })
    writeFileSync(marker, new Date().toISOString() + "\toperator-approval-via-prompt\n")
  }
  process.exit(0)
} catch {
  process.exit(0) // fail-open: сбой хука не мешает работе
}
