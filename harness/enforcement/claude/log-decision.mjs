#!/usr/bin/env node
// Claude Code PostToolUse-хук на инструмент Task. Кросс-платформенный (Node).
// Гарантированный decisions.log: дописывает строку на каждое делегирование роли.
// Вход: JSON на stdin (tool_input{subagent_type}). cwd = каталог проекта.
// Best-effort: сбой записи (например read-only FS) НЕ валит делегирование.
import { mkdirSync, appendFileSync } from "node:fs"
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
  try { input = JSON.parse(raw) } catch { process.exit(0) }
  const role = pickRole(input)
  if (!role) process.exit(0)

  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const dir = join(root, ".agent")
  mkdirSync(dir, { recursive: true })
  const ts = new Date().toISOString()
  appendFileSync(join(dir, "decisions.log"), `${ts}\trole=${role}\tvia=claude-hook\n`)
} catch {
  // аудит best-effort
}
process.exit(0)
