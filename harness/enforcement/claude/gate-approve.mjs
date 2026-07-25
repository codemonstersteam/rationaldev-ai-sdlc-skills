#!/usr/bin/env node
// Claude Code хук акцепта — паритет с opencode (chat.message + question.replied). Ловит явные ТОКЕНЫ оператора:
//   «GATE1 APPROVE» → .agent/gates/gate1.approved (акцепт плана),
//   «GATE2 APPROVE» → .agent/gates/gate2.approved (акцепт мержа PR; открывает @ledger).
// ДВА канала оператора, один хук:
//   UserPromptSubmit — токен напечатан в чат ({prompt,…});
//   PostToolUse[AskUserQuestion] — токен ВЫБРАН пунктом меню ({tool_name,tool_response,…}): выбор опции
//     промпта не порождает, и без этого канала «нажал кнопку» гейт не открывал.
// Это реплика оператора (не агента) — агенту self-accept по-прежнему запрещён (gate-bash). Общая
// логика распознавания — ../shared.mjs (isOperatorApproval/isGate2Approval), единая с плагином.
// Выход: exit 0 (ни промпт, ни тул НЕ блокируем). Fail-open на любой ошибке.
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { join } from "node:path"
import {
  isOperatorApproval, isGate2Approval, planReadyForApproval, currentGreenfieldSlices, mergeReadyForApproval,
  prRefFromText, gateMarkerContent, answerTextFromToolResponse, DESIGN_DIR, PLAN_REVIEW_MARK, CHORES_DIR,
  SLICES_MARK, CHANGE_DIR_MARK, CHORE_DIR_MARK, MODE_MARK,
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
  // Канал реплики: PostToolUse несёт tool_name — тогда акцепт берём ТОЛЬКО из выбора оператора
  // (tool_response), и ни в коем случае не из tool_input: вопрос сочиняет агент, ответ даёт человек.
  // Чужой тул в этом событии игнорируем — на prompt не откатываемся (в тул-пейлоаде его и нет).
  const toolName = String(input?.tool_name ?? input?.toolName ?? "")
  const viaQuestion = toolName === "AskUserQuestion"
  if (toolName && !viaQuestion) process.exit(0)
  const prompt = viaQuestion
    ? answerTextFromToolResponse(input?.tool_response ?? input?.toolResponse)
    : String(input?.prompt ?? input?.user_prompt ?? input?.message ?? "")
  const source = viaQuestion ? "operator-approval-via-question" : "operator-approval-via-prompt"
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
    const readMaybe = (rel) => { try { return readFileSync(join(root, rel), "utf8") } catch { return "" } }
    const designDirs = () => { try { return readdirSync(join(root, DESIGN_DIR)) } catch { return [] } }
    // greenfield-срезы учитываем ТОЛЬКО в greenfield-полосе — иначе stale slices.md прошлого прогона
    // (он вне текущего WIPE-списка close-run) ложно «подтвердил» бы план в patch/chore-полосе.
    const greenfield = readMaybe(MODE_MARK).replace(/^﻿/, "").trim() === "greenfield"
    const planReady = planReadyForApproval(existsFn, {
      changeDir: readMaybe(CHANGE_DIR_MARK),
      choreDir: readMaybe(CHORE_DIR_MARK),
      sliceDirs: greenfield ? currentGreenfieldSlices(readMaybe(SLICES_MARK), designDirs()) : [],
    })
    if (planReady) {
      put("gate1.approved", gateMarkerContent({
        timestamp: new Date().toISOString(),
        source,
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
      source,
      prompt,
      ref: prRefFromText(prompt),
    }))
  }
  process.exit(0)
} catch {
  process.exit(0) // fail-open: сбой хука не мешает работе
}
