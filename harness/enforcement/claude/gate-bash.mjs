#!/usr/bin/env node
// Claude Code PreToolUse-хук на инструмент Bash. Зеркалит bash-часть opencode-плагина (общая логика —
// ../shared.mjs). Enforce-ит:
//   1) само-запись маркера Gate #1 (touch/>/tee … gate1.approved) → блок (самоакцепт запрещён);
//   2) poka-yoke: запись `ticket-NN <slice> green` в done.log ТОЛЬКО если объявленные `outputs` тикета
//      существуют и непусты (ловит «зелёный без артефакта» дёшево, до приёмки).
// Вход: JSON на stdin (tool_input{command}). Выход: exit 2 → Claude блокирует. Fail-open на инфра-сбое.
import { existsSync, readFileSync, statSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { writesGateMarker, doneGreenTicketId, parseTicketOutputs } from "../shared.mjs"

async function readStdin() {
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  return Buffer.concat(chunks).toString("utf8")
}
const block = (msg) => { process.stderr.write("[rational-guardrail] " + msg + "\n"); process.exit(2) }

// По id тикета вернуть его объявленные `outputs`, которых НЕТ или которые пусты.
function missingOutputs(root, id) {
  let text = null
  try {
    const designDir = join(root, "docs", "design")
    for (const slice of readdirSync(designDir)) {
      const tdir = join(designDir, slice, "tickets")
      let files
      try { files = readdirSync(tdir) } catch { continue }
      const hit = files.find((f) => new RegExp(`^ticket-0*${id}\\.md$`).test(f))
      if (hit) { text = readFileSync(join(tdir, hit), "utf8"); break }
    }
  } catch { return [] }
  if (!text) return []
  const missing = []
  for (const p of parseTicketOutputs(text)) {
    try { const st = statSync(join(root, p)); if (st.isFile() && st.size === 0) missing.push(p) }
    catch { missing.push(p) }
  }
  return missing
}

try {
  const raw = await readStdin()
  let input = {}
  try { input = JSON.parse(raw) } catch { process.exit(0) }
  const ti = input?.tool_input ?? input?.toolInput ?? input?.args ?? {}
  const cmd = String(ti?.command ?? "")
  if (!cmd) process.exit(0)
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()

  // (1) само-запись маркера Gate #1
  if (writesGateMarker(cmd)) {
    block(
      "Маркер Gate #1 (.agent/gates/gate1.approved) ставит ТОЛЬКО оператор вне сессии. Создавать/писать " +
      "его агенту запрещено — на Gate #1 задай question и жди. (Чтение `ls`/`test -f` разрешено.)",
    )
  }

  // (2) poka-yoke: green-маркер без непустых outputs
  const greenId = doneGreenTicketId(cmd)
  if (greenId) {
    const miss = missingOutputs(root, greenId)
    if (miss.length) {
      block(
        "poka-yoke: ticket-" + greenId + " помечается `green`, но его объявленные `outputs` отсутствуют/пусты: " +
        miss.join(", ") + ". Маркер НЕ записан — доведи артефакт(ы) до непустого состояния или не пиши `green`.",
      )
    }
  }
  process.exit(0)
} catch {
  process.exit(0) // fail-open
}
