// CLI-оболочка (I/O) валидатора карты контекстов (domain-context-adr-layout, Ф4). Логика —
// lib/validators.mjs (validateContextMap, чисто). Мягкий гейт: при ≥2 CONTEXT.md — root
// CONTEXT-MAP.md существует, ссылки резолвятся, есть секция Relationships, каждый контекст
// покрыт картой; ADR-нумерация последовательна (1..n, per dir). Single-context не трогает
// (нет ложных blocker). Опц. гейт у @mills (S3-покрытие — контексты/связи не потеряны).
//
// Запуск: node harness/validate-context-map.mjs [projectRoot]
// exit 0 = ок / single-context; exit 1 = карта неполна / битые ссылки / ADR-нумерация (stderr).
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs"
import { join } from "node:path"
import { validateContextMap } from "./lib/validators.mjs"

const root = process.argv[2] || process.cwd()
const design = join(root, "docs", "design")
const slices = () => (existsSync(design) ? readdirSync(design).filter((d) => d.startsWith("slice-")) : [])

// 1) CONTEXT.md: root + docs/design/slice-*/
const contextPaths = []
if (existsSync(join(root, "CONTEXT.md"))) contextPaths.push("CONTEXT.md")
for (const s of slices())
  if (existsSync(join(design, s, "CONTEXT.md"))) contextPaths.push(join("docs/design", s, "CONTEXT.md"))

// 2) root CONTEXT-MAP.md
const mapPath = join(root, "CONTEXT-MAP.md")
const mapText = existsSync(mapPath) ? readFileSync(mapPath, "utf8") : ""

// 3) ADR-директории + номера (root docs/adr + per-slice adr): файлы вида NNNN-slug.md
const adrDirs = []
const collectAdr = (dir, label) => {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return
  const numbers = []
  for (const f of readdirSync(dir)) {
    const m = f.match(/^(\d+)[-_].*\.md$/i)
    if (m) numbers.push(Number(m[1]))
  }
  if (numbers.length) adrDirs.push({ dir: label, numbers })
}
collectAdr(join(root, "docs", "adr"), "docs/adr")
for (const s of slices()) collectAdr(join(design, s, "adr"), join("docs/design", s, "adr"))

const errors = validateContextMap(contextPaths, mapText, adrDirs)
if (errors.length) {
  console.error("validate-context-map: КАРТА КОНТЕКСТОВ неполна / ADR-нумерация:")
  for (const e of errors) console.error(`  ✗ ${e}`)
  console.error("  → ≥2 CONTEXT.md ⇒ root CONTEXT-MAP.md (ссылки + Relationships); ADR — 1..n без дыр per dir.")
  process.exit(1)
}
const mode = contextPaths.length >= 2 ? `multi (${contextPaths.length} контекста, карта цела)` : "single-context (гейт не требуется)"
console.log(`validate-context-map: OK — ${mode}`)
