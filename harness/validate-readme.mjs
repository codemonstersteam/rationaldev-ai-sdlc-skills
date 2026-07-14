#!/usr/bin/env node
// Механический гейт ФОРМЫ README против скилла `documentation` (Procedure A). Проза Procedure A сама
// не энфорсится — быстрая модель делает существо, но пропускает форму (run 13-07: README прошёл всё,
// а can/cannot-блок, лестницу-ссылок и pointer — нет). Этот валидатор ловит структурный скелет; СЕМАНТИКУ
// (качество прозы) не трогает — она остаётся @fagan. Профиль-aware: для cli пропускает A4/A5 (API-таблица/pipe).
// Запуск: node harness/validate-readme.mjs [project-root]. exit 0 — ок; exit 1 — список нарушений.
import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = process.argv[2] || process.cwd()
const rd = (p) => { try { return readFileSync(join(root, p), "utf8") } catch { return "" } }

// профиль (shape) — из target-profiles.json + .agent/planner/target (как в validate-dod)
function loadProfile() {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    const prof = JSON.parse(readFileSync(join(here, "target-profiles.json"), "utf8"))
    const marker = (rd(".agent/planner/target").trim() || prof.default || "service")
    return { shape: marker, ...(prof.profiles?.[marker] || {}) }
  } catch { return { shape: "service" } }
}

const README = rd("README.md")
if (!README) { console.error("validate-readme: README.md отсутствует или пуст"); process.exit(1) }
const prof = loadProfile()
const isCli = prof.shape === "cli"
const errors = []
const low = README.toLowerCase()
const lines = README.replace(/\r\n/g, "\n").split("\n")

// --- A1: заголовок + ОДНО предложение-интро (≤ ~22 слова), не абзац ---
const titleIdx = lines.findIndex((l) => /^#\s+\S/.test(l))
if (titleIdx < 0) errors.push("A1: нет заголовка `# <name>`")
else {
  const after = lines.slice(titleIdx + 1).find((l) => l.trim() && !l.startsWith("#") && !l.startsWith(">"))
  if (!after) errors.push("A1: нет вводного предложения после заголовка")
  else {
    const sentences = after.trim().split(/(?<=[.!?])\s+/).filter(Boolean)
    const words = after.trim().split(/\s+/).length
    if (sentences.length > 1 || words > 22)
      errors.push(`A1: интро должно быть ОДНИМ предложением ≤22 слов (сейчас ${sentences.length} предл., ${words} слов) — не абзац`)
  }
}

// --- A2: блок Can / Cannot (две границы) ---
if (!/\bcan\b|умеет|does?/.test(low) || !/\bcannot\b|can['’ ]?t\b|не умеет|does not|не делает/.test(low))
  errors.push("A2: нет структурного блока границ Can / Cannot (обе стороны — что умеет и что НЕ умеет)")

// --- A5b: failure-таблица содержит КАЖДЫЙ error.code контракта ---
const ec = rd("api-specification/exit-codes.md") || rd(prof.contract?.find((c) => /exit-codes/.test(c)) || "")
const codes = [...new Set((ec.match(/\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/g) || []))]
const missing = codes.filter((c) => !README.includes(c))
if (codes.length && missing.length)
  errors.push(`A5b: failure-таблица не содержит error.code: ${missing.join(", ")} (каждый код контракта обязан быть строкой)`)
if (codes.length && !/(карта\s+режимов\s+отказа|failure|exit)/i.test(low))
  errors.push("A5b: нет секции карты режимов отказа / failure-таблицы")

// --- A6: run-команды + ссылка на component-tests/ ---
if (!/component-tests/.test(low)) errors.push("A6: нет ссылки на `component-tests/` (как гонять из-вне)")
if (!/```|`\w|\$\s|\bgo (build|run|test)\b|docker/.test(README)) errors.push("A6: нет исполняемых команд (build/run)")

// --- A7: лестница-ссылок внутрь (design → architecture → ADR как ССЫЛКИ, не тело) ---
if (!/\]\(.*docs\/design\//.test(README) && !/docs\/design\//.test(README))
  errors.push("A7: нет ссылки на `docs/design/<slice>/` (лестница retrievability — use-case/module-tree/c4)")
if (!/architecture/i.test(low)) errors.push("A7: нет упоминания/ссылки на архитектуру (docs/architecture.md или платформенный pointer)")
// ADR-ссылка обязательна ТОЛЬКО если у проекта есть docs/adr/ (иначе нечего линковать — не false-positive)
if (existsSync(join(root, "docs/adr")) && !/\badr\b|docs\/adr/i.test(low))
  errors.push("A7: есть docs/adr/, но нет ссылки на него (почему так сделано)")

// --- A4/A5 (только service): API-таблица + pipe на эндпойнт ---
if (!isCli) {
  if (!/\|\s*(method|метод)\s*\|/i.test(README)) errors.push("A4: нет API-таблицы method|resource|action")
}

if (errors.length) {
  console.error(`validate-readme: README не проходит Procedure A (${prof.shape}) — ${errors.length} нарушений:`)
  for (const e of errors) console.error("  ✗ " + e)
  process.exit(1)
}
console.log(`validate-readme: OK — README проходит структурный Procedure A (профиль ${prof.shape}, ${codes.length} error.code в таблице)`)
