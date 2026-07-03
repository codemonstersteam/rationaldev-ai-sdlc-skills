// CLI-оболочка (I/O) валидатора FRD. Логика — в lib/validators.mjs (validateFrd, чисто).
// Antecedent на входе планирования: wirth-slicer принимает FRD, только если он полон.
// Запуск: node harness/validate-frd.mjs [frdPath]   (по умолч. .agent/planner/frd.md от cwd)
// exit 0 = годен; exit 1 = чего не хватает (stderr).
import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { validateFrd, validateFrdUseCases } from "./lib/validators.mjs"

const frd = process.argv[2] || join(process.cwd(), ".agent", "planner", "frd.md")
if (!existsSync(frd)) { console.error(`validate-frd: нет файла FRD ${frd}`); process.exit(1) }
const text = readFileSync(frd, "utf8")
// (1) структурная полнота + (2) анти-переусложнение: UC не должны быть framework/boot/generic-error
const errors = [...validateFrd(text), ...validateFrdUseCases(text)]
if (errors.length) {
  console.error(`validate-frd: FRD не проходит (${frd}):`)
  for (const e of errors) console.error(`  ✗ ${e}`)
  process.exit(1)
}
console.log("validate-frd: OK — FRD полон и без псевдо-UC (один внешний запрос = один use case, отказы = Extensions)")
