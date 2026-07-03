#!/usr/bin/env node
// Claude Code PreToolUse-хук на инструмент Task. Кросс-платформенный (Node, без POSIX-утилит:
// работает под Windows/PowerShell, macOS, Linux одинаково).
// Жёсткий Gate #1: блокирует делегирование роли implementer, пока план не принят.
// Вход: JSON на stdin (tool_name, tool_input{subagent_type,...}). cwd = каталог проекта.
// Выход: exit 2 → Claude блокирует вызов и показывает stderr модели.
//
// Fail-open: любая инфра-ошибка (не разобрался JSON, нет stdin) НЕ должна рубить делегацию —
// иначе агент не сможет даже сохранить план. Жёсткий стоп — только осознанный (implementer без гейта).
import { existsSync } from "node:fs"
import { join } from "node:path"

const ROLE_KEYS = ["subagent_type", "subagentType", "subagent", "agent", "agentType"]

function pickRole(input) {
  const ti = input?.tool_input ?? input?.toolInput ?? input?.args ?? {}
  for (const k of ROLE_KEYS) if (typeof ti?.[k] === "string") return ti[k]
  return ""
}

async function readStdin() {
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  return Buffer.concat(chunks).toString("utf8")
}

try {
  const raw = await readStdin()
  let input = {}
  try { input = JSON.parse(raw) } catch { process.exit(0) } // не наш формат → не мешаем
  const role = pickRole(input)
  if (role !== "hughes" && role !== "wirth-tester" && role !== "scaffolder") process.exit(0)

  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const review = join(root, ".agent", "plan-reviewer", "plan-review.md")
  const gate1 = join(root, ".agent", "gates", "gate1.approved")
  if (!existsSync(review) || !existsSync(gate1)) {
    process.stderr.write(
      "[rational-guardrail] Gate #1 не пройден: нужны .agent/plan-reviewer/plan-review.md и " +
      ".agent/gates/gate1.approved перед делегированием реализации (hughes/wirth-tester).\n",
    )
    process.exit(2)
  }
  process.exit(0)
} catch {
  process.exit(0) // fail-open: инфра-сбой хука не блокирует работу агента
}
