#!/usr/bin/env node
// Claude Code UserPromptSubmit-хук — паритет с opencode chat.message. Ловит явные ТОКЕНЫ оператора:
//   «GATE1 APPROVE» → .agent/gates/gate1.approved (акцепт плана),
//   «GATE2 APPROVE» → .agent/gates/gate2.approved (акцепт мержа PR; открывает @ledger).
// Это сообщение оператора (не агента) — агенту self-accept по-прежнему запрещён (gate-bash). Общая
// логика распознавания — ../shared.mjs (isOperatorApproval/isGate2Approval), единая с плагином.
// Вход: JSON на stdin ({prompt,…}). Выход: exit 0 (промпт НЕ блокируем). Fail-open на любой ошибке.
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { join } from "node:path"
import {
  isOperatorApproval, isGate2Approval, planReadyForApproval, mergeReadyForApproval, prRefFromText,
  gateMarkerContent, DESIGN_DIR, PLAN_REVIEW_MARK, CHORES_DIR,
} from "../shared.mjs"

// Хеш снимка плана НА МОМЕНТ акцепта (аудит): greenfield docs/design/*/PLAN.md + change-папки
// SemVer-полосы changes/*/PLAN.md
// + chore docs/chores/*/CHORE-PLAN.md + plan-review.md (sorted). best-effort: сбой → "na" (provenance, не enforcement).
function planHash(root) {
  try {
    const parts = []
    const designDir = join(root, DESIGN_DIR)
    for (const d of readdirSync(designDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
      const p = join(designDir, d, "PLAN.md")
      if (existsSync(p)) parts.push(d + "\n" + readFileSync(p, "utf8"))
      try { // change-scoped планы SemVer-полосы: docs/design/<slice>/changes/<slug>/PLAN.md
        const changesRoot = join(designDir, d, "changes")
        for (const ch of readdirSync(changesRoot).sort()) {
          const cp = join(changesRoot, ch, "PLAN.md")
          if (existsSync(cp)) parts.push(d + "/" + ch + "\n" + readFileSync(cp, "utf8"))
        }
      } catch { /* нет changes/ */ }
    }
    try { // chore-планы: docs/chores/<slug>/CHORE-PLAN.md
      const choresDir = join(root, CHORES_DIR)
      for (const c of readdirSync(choresDir).sort()) {
        const cp = join(choresDir, c, "CHORE-PLAN.md")
        if (existsSync(cp)) parts.push("chore/" + c + "\n" + readFileSync(cp, "utf8"))
      }
    } catch { /* нет docs/chores/ */ }
    const pr = join(root, PLAN_REVIEW_MARK)
    if (existsSync(pr)) parts.push("plan-review\n" + readFileSync(pr, "utf8"))
    return parts.length ? createHash("sha256").update(parts.join("\n---\n")).digest("hex").slice(0, 16) : "na"
  } catch { return "na" }
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
  const prompt = String(input?.prompt ?? input?.user_prompt ?? input?.message ?? "")
  const gate1 = isOperatorApproval(prompt), gate2 = isGate2Approval(prompt)
  if (!gate1 && !gate2) process.exit(0)

  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const existsFn = (rel) => existsSync(join(root, rel))
  const gatesDir = join(root, ".agent", "gates")
  // Идемпотентная запись: первый акцепт фиксируется, повтор не клобберит provenance.
  const put = (file, content) => {
    const marker = join(gatesDir, file)
    if (existsSync(marker)) return
    mkdirSync(gatesDir, { recursive: true })
    writeFileSync(marker, content)
  }

  // Акцепт валиден ТОЛЬКО когда план СОБРАН (есть PLAN.md/plan-review.md) — иначе «go ahead» на
  // ранней фазе ложно ставит маркер и обнуляет человеческий Gate #1. Нет плана → игнорируем акцепт.
  if (gate1) {
    const sliceDirsFn = () => { try { return readdirSync(join(root, DESIGN_DIR)) } catch { return [] } }
    const choreDirsFn = () => { try { return readdirSync(join(root, CHORES_DIR)) } catch { return [] } }
    if (planReadyForApproval(existsFn, sliceDirsFn, choreDirsFn)) {
      put("gate1.approved", gateMarkerContent({
        timestamp: new Date().toISOString(),
        source: "operator-approval-via-prompt",
        prompt,
        planHash: planHash(root),
      }))
    }
  }

  // Gate #2 (мерж): валиден только когда работа дошла до мержа — Gate #1 пройден и ветка прогона есть.
  // Provenance — PR-референс из реплики оператора (вместо plan_hash).
  if (gate2 && mergeReadyForApproval(existsFn)) {
    put("gate2.approved", gateMarkerContent({
      timestamp: new Date().toISOString(),
      source: "operator-approval-via-prompt",
      prompt,
      ref: prRefFromText(prompt),
    }))
  }
  process.exit(0)
} catch {
  process.exit(0) // fail-open: сбой хука не мешает работе
}
