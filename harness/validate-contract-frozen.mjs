// CLI-оболочка (I/O) валидатора контракта. Логика OpenAPI/AsyncAPI — lib/validators.mjs (validateContractFrozen).
// Antecedent на входе дизайна модулей: wirth-moduledesigner проектирует против полного, замороженного контракта.
// ДЕЛЕГИРУЕТ target-профилю (harness/target-profiles.json): service → openapi/asyncapi x-frozen;
// cli → config.schema.json + report.schema.json (наличие + валидный JSON Schema = замороженный контракт CLI).
// Запуск: node harness/validate-contract-frozen.mjs [contractPath]   (без арга — из профиля формы).
// exit 0 = полон и заморожен; exit 1 = проблемы (stderr).
import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { validateContractFrozen } from "./lib/validators.mjs"
import { loadProfile } from "./validate-dod.mjs"

const root = process.cwd()
const explicit = process.argv[2]

// найти файл под api-specification/, чей путь оканчивается на entry (прямо или на 1 уровень вложенности)
function findContract(specDir, entry) {
  const direct = join(specDir, entry)
  if (existsSync(direct)) return direct
  try {
    for (const f of readdirSync(specDir)) if (f.toLowerCase().endsWith(entry.toLowerCase())) return join(specDir, f)
  } catch { /* нет каталога */ }
  return null
}

// проверка одного контракт-файла по типу: OpenAPI/AsyncAPI → x-frozen; JSON Schema → валидный JSON.
function checkOne(path) {
  const text = readFileSync(path, "utf8")
  if (/\.ya?ml$/i.test(path) && /(openapi|asyncapi)\s*:/.test(text)) {
    const errors = validateContractFrozen(text)
    if (errors.length) { console.error(`validate-contract-frozen: контракт НЕ готов (${path}):`); for (const e of errors) console.error(`  ✗ ${e}`); process.exit(1) }
    return /asyncapi\s*:/.test(text) ? "AsyncAPI x-frozen" : "OpenAPI x-frozen"
  }
  if (/\.json$/i.test(path)) {
    try { JSON.parse(text) } catch (e) { console.error(`validate-contract-frozen: невалидный JSON Schema (${path}): ${e.message}`); process.exit(1) }
    return "JSON Schema"
  }
  return "present"
}

if (explicit) {
  if (!existsSync(explicit)) { console.error(`validate-contract-frozen: нет контракта (${explicit})`); process.exit(1) }
  const kind = checkOne(explicit)
  console.log(`validate-contract-frozen: OK — контракт полон и заморожен (${kind})`)
} else {
  const profile = loadProfile(root)
  const specDir = join(root, "api-specification")
  const kinds = []
  for (const c of (profile.contract ?? ["openapi.yaml"])) {
    const hit = findContract(specDir, c)
    if (!hit) { console.error(`validate-contract-frozen: нет контракт-артефакта '${c}' под api-specification/ (форма '${profile.shape}')`); process.exit(1) }
    kinds.push(checkOne(hit))
  }
  console.log(`validate-contract-frozen: OK — контракт формы '${profile.shape}' готов (${kinds.join(" + ")})`)
}
