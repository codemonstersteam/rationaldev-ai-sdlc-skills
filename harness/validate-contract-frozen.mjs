// CLI-оболочка (I/O) валидатора контракта. Логика — в lib/validators.mjs (validateContractFrozen).
// Antecedent на входе дизайна модулей: wirth-moduledesigner проектирует против полного,
// замороженного контракта (маркер x-frozen — его ставит wirth-apidesigner).
// Запуск: node harness/validate-contract-frozen.mjs [contractPath]   (по умолч. api-specification/{openapi,asyncapi}.yaml)
// exit 0 = полон и заморожен; exit 1 = проблемы (stderr).
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { validateContractFrozen } from "./lib/validators.mjs"

const root = process.cwd()
const explicit = process.argv[2]
const candidates = explicit
  ? [explicit]
  : [join(root, "api-specification", "openapi.yaml"), join(root, "api-specification", "asyncapi.yaml")]
const path = candidates.find((p) => existsSync(p))
if (!path) { console.error(`validate-contract-frozen: нет контракта (${candidates.join(" | ")})`); process.exit(1) }

const text = readFileSync(path, "utf8")
const errors = validateContractFrozen(text)
if (errors.length) {
  console.error(`validate-contract-frozen: контракт НЕ готов (${path}):`)
  for (const e of errors) console.error(`  ✗ ${e}`)
  process.exit(1)
}
const isAsync = /asyncapi\s*:/.test(text)
console.log(`validate-contract-frozen: OK — контракт полон и заморожен (${isAsync ? "AsyncAPI" : "OpenAPI"}, x-frozen)`)
