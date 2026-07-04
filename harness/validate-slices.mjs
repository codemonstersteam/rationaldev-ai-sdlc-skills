// CLI-оболочка валидатора срезов (harden-decomposition). Логика — в lib/validators.mjs
// (validateSlices, чисто). Ловит ПЕРЕУСЛОЖНЕНИЕ: срезов больше, чем внешних входов (operations
// контракта), и псевдо-срезы (framework 4xx/метод/роут, boot config, тип-тикета scaffold).
// Antecedent у wirth-slicer (если контракт готов) + обязательный у @mills.
//
// Запуск: node harness/validate-slices.mjs [slicesPath] [openapiPath]
//   по умолчанию: .agent/planner/slices.md + api-specification/openapi.yaml (от cwd)
// exit 0 = годен; exit 1 = переусложнение/псевдо-срезы (stderr).
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { validateSlices } from "./lib/validators.mjs"

const root = process.cwd()
const slicesPath = process.argv[2] || join(root, ".agent", "planner", "slices.md")
const oapiPath = process.argv[3] || join(root, "api-specification", "openapi.yaml")
if (!existsSync(slicesPath)) { console.error(`validate-slices: нет файла срезов ${slicesPath}`); process.exit(1) }
const slices = readFileSync(slicesPath, "utf8")
const oapi = existsSync(oapiPath) ? readFileSync(oapiPath, "utf8") : ""

const errors = validateSlices(slices, oapi)
if (errors.length) {
  console.error(`validate-slices: ПЕРЕУСЛОЖНЕНИЕ декомпозиции (${slicesPath}):`)
  for (const e of errors) console.error(`  ✗ ${e}`)
  console.error(`  → правило: 1 внешний вход (endpoint) = 1 срез; отказы/framework/boot/scaffold — НЕ срезы.`)
  process.exit(1)
}
console.log("validate-slices: OK — срезы атомарны (каждый = отдельный внешний вход, псевдо-срезов нет)")
