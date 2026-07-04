// CLI-оболочка валидатора Mermaid-диаграмм (C4). Логика — в lib/validators.mjs (validateMermaid,
// чисто). Ловит невалидный C4/Mermaid (UML-стереотипы <<...>>, нет объявления типа диаграммы,
// не-C4-стейтменты) → «Syntax error» на рендере. Consequent у wirth-moduledesigner (пишет c4.md) +
// обязательный у @mills. «Тот, кто рисует C4, проверяет, что оно рендерится.»
//
// Запуск: node harness/validate-mermaid.mjs [file.md ...]
//   без аргументов: все docs/design/slice-*/c4.md (от cwd)
// exit 0 = все Mermaid-блоки валидны; exit 1 = синтаксис сломан (stderr).
import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { validateMermaid } from "./lib/validators.mjs"

const root = process.cwd()
let files = process.argv.slice(2)
if (!files.length) {
  const design = join(root, "docs", "design")
  if (existsSync(design)) {
    for (const s of readdirSync(design).filter((d) => d.startsWith("slice-"))) {
      const c4 = join(design, s, "c4.md")
      if (existsSync(c4)) files.push(c4)
    }
  }
}
if (!files.length) { console.error("validate-mermaid: не найдено c4.md (docs/design/slice-*/c4.md)"); process.exit(1) }

let bad = 0
for (const f of files) {
  if (!existsSync(f)) { console.error(`validate-mermaid: нет файла ${f}`); bad++; continue }
  const errors = validateMermaid(readFileSync(f, "utf8"))
  if (errors.length) {
    bad++
    console.error(`validate-mermaid: НЕВАЛИДНЫЙ Mermaid/C4 (${f}):`)
    for (const e of errors) console.error(`  ✗ ${e}`)
  }
}
if (bad) {
  console.error(`  → используй Mermaid-C4 функции из скилла c4 (Component()/Rel()/Container_Boundary(){}), не UML-стереотипы.`)
  process.exit(1)
}
console.log(`validate-mermaid: OK — Mermaid/C4 валиден (${files.length} файл(ов))`)
