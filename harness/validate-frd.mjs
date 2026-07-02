// CLI-оболочка (I/O) валидатора FRD. Логика — в lib/validators.mjs (validateFrd, чисто).
// Antecedent на входе планирования: wirth-slicer принимает FRD, только если он полон.
// Запуск: node harness/validate-frd.mjs [frdPath]   (по умолч. .agent/planner/frd.md от cwd)
// exit 0 = годен; exit 1 = чего не хватает (stderr).
import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { validateFrd } from "./lib/validators.mjs"

const frd = process.argv[2] || join(process.cwd(), ".agent", "planner", "frd.md")
if (!existsSync(frd)) { console.error(`validate-frd: нет файла FRD ${frd}`); process.exit(1) }
const errors = validateFrd(readFileSync(frd, "utf8"))
if (errors.length) {
  console.error(`validate-frd: FRD НЕ полон (${frd}):`)
  for (const e of errors) console.error(`  ✗ ${e}`)
  process.exit(1)
}
console.log("validate-frd: OK — FRD структурно полон (акторы, use-cases с Extensions, контракт-черновик, карта отказов)")
