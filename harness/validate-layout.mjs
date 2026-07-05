// CLI-оболочка (I/O) валидатора slice-aligned раскладки. Логика — lib/validators.mjs
// (validateLayout, чисто). Правило (slice-aligned-code-layout): каждый code-путь под internal/
// лежит под internal/<slug>/ ОБЪЯВЛЕННОГО среза ИЛИ под internal/shared/. Layer-keyed корень
// (internal/io, internal/httpapi, internal/catalog, …) = blocker — вертикальная граница потеряна.
//
// Источник slugs: slices.md `Owns package: internal/<slug>/` + имена docs/design/slice-*.
// Источник путей: тела тикетов (DoD-чеклист) + слайс-карты дизайна + реальные подпапки internal/
// (если код уже сгенерирован — валидатор годен и на этапе плана, и после реализации).
// Antecedent у wirth-moduledesigner; обязательный гейт у @mills (Gate #1).
//
// Запуск: node harness/validate-layout.mjs [projectRoot] [slicesPath] [--declarations]
//   projectRoot — где docs/design и internal/ (по умолчанию cwd)
//   slicesPath  — по умолчанию .agent/planner/slices.md (от projectRoot)
//   --declarations (рунг 1, у wirth-slicer) — проверить, что КАЖДЫЙ срез объявил `Owns package:
//                  internal/<slug>/` (не layer-keyed); paths-режим (рунг 2/3, moduledesigner/mills) — по умолчанию.
// exit 0 = slice-aligned; exit 1 = layer-keyed протечка / необъявленная граница (stderr).
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs"
import { join } from "node:path"
import { validateLayout, validateSliceDeclarations } from "./lib/validators.mjs"

const argv = process.argv.slice(2)
const declMode = argv.includes("--declarations") || argv.includes("--decl")
const pos = argv.filter((a) => !a.startsWith("--"))
const root = pos[0] || process.cwd()
const slicesPath = pos[1] || join(root, ".agent", "planner", "slices.md")
const design = join(root, "docs", "design")

// --- Рунг 1: declaration-mode (у слайсера) — граница объявлена до дизайна ---
if (declMode) {
  if (!existsSync(slicesPath)) { console.error(`validate-layout --declarations: нет файла срезов ${slicesPath}`); process.exit(1) }
  const errs = validateSliceDeclarations(readFileSync(slicesPath, "utf8"))
  if (errs.length) {
    console.error("validate-layout --declarations: граница пакета среза НЕ объявлена / layer-keyed:")
    for (const e of errs) console.error(`  ✗ ${e}`)
    console.error("  → каждый срез обязан нести `Owns package: internal/<slug>/` (не internal/io|httpapi|catalog|…).")
    process.exit(1)
  }
  console.log("validate-layout --declarations: OK — каждый срез объявил internal/<slug>/ (граница названа до дизайна)")
  process.exit(0)
}

// 1) объявленные срезы (slugs)
const slugs = new Set()
if (existsSync(slicesPath))
  for (const m of readFileSync(slicesPath, "utf8").matchAll(/Owns package:\s*`?\s*internal\/([a-z0-9_-]+)\/?/gi))
    slugs.add(m[1].toLowerCase())
if (existsSync(design))
  for (const d of readdirSync(design).filter((d) => d.startsWith("slice-")))
    slugs.add(d.replace(/^slice-/, "").toLowerCase())

// 2) code-пути internal/… из тел тикетов и слайс-карт дизайна
const paths = new Set()
const grep = (text) => { for (const m of String(text).matchAll(/internal\/[a-z0-9_-]+\/[a-z0-9_./-]+/gi)) paths.add(m[0]) }
if (existsSync(design))
  for (const slice of readdirSync(design).filter((d) => d.startsWith("slice-"))) {
    for (const dir of [join(design, slice), join(design, slice, "tickets")]) {
      if (!existsSync(dir) || !statSync(dir).isDirectory()) continue
      for (const f of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
        const abs = join(dir, f)
        if (statSync(abs).isFile()) grep(readFileSync(abs, "utf8"))
      }
    }
  }
// реальные подпапки internal/<root>/ (если код уже есть) — двойная проверка после реализации
const internalDir = join(root, "internal")
if (existsSync(internalDir))
  for (const d of readdirSync(internalDir)) {
    const abs = join(internalDir, d)
    if (statSync(abs).isDirectory()) paths.add(`internal/${d}/`)
  }

if (!paths.size) {
  console.log("validate-layout: нет code-путей internal/… для проверки (нечего валидировать)")
  process.exit(0)
}

const errors = validateLayout([...paths], [...slugs])
if (errors.length) {
  console.error("validate-layout: LAYER-KEYED РАСКЛАДКА — вертикальная граница среза потеряна:")
  for (const e of errors) console.error(`  ✗ ${e}`)
  console.error("  → правило: код среза живёт в internal/<slug>/; общее ≥2 срезов — только internal/shared/.")
  process.exit(1)
}
console.log(`validate-layout: OK — slice-aligned (срезы: ${[...slugs].join(", ") || "—"}; путей проверено: ${paths.size})`)
