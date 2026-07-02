// Antecedent-валидатор контракта — «конструктор» на входе дизайна модулей: потребитель
// (wirth-moduledesigner) проектирует ТОЛЬКО против полного, замороженного контракта.
// Проверяет структурную полноту OpenAPI/AsyncAPI (эвристикой по тексту — без YAML-зависимостей)
// и МАРКЕР ЗАМОРОЗКИ `x-frozen` (его ставит wirth-apidesigner при freeze).
//
// Запуск: node harness/validate-contract-frozen.mjs [contractPath]
//   по умолчанию ищет api-specification/openapi.yaml, затем asyncapi.yaml (относительно cwd).
// exit 0 = контракт полон и заморожен; exit 1 = проблемы (на stderr).
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const explicit = process.argv[2]
const candidates = explicit
  ? [explicit]
  : [join(root, "api-specification", "openapi.yaml"), join(root, "api-specification", "asyncapi.yaml")]
const path = candidates.find((p) => existsSync(p))
if (!path) { console.error(`validate-contract-frozen: нет контракта (${candidates.join(" | ")})`); process.exit(1) }

const t = readFileSync(path, "utf8").replace(/\r\n/g, "\n")
const errors = []
const isAsync = /asyncapi\s*:/.test(t)

if (isAsync) {
  if (!/^\s*asyncapi\s*:/m.test(t)) errors.push("нет поля asyncapi:")
  if (!/^\s*channels\s*:/m.test(t)) errors.push("нет channels: (ни одного канала)")
  if (!/^\s*(components|messages)\s*:/m.test(t)) errors.push("нет messages/components (схемы сообщений)")
} else {
  if (!/^\s*openapi\s*:/m.test(t)) errors.push("нет поля openapi: (не OpenAPI-документ)")
  if (!/^\s*paths\s*:/m.test(t)) errors.push("нет paths:")
  else if (!/^\s{2,}\/\S/m.test(t)) errors.push("paths: пуст — ни одного эндпоинта")
  if (!/responses\s*:/.test(t)) errors.push("нет responses: (операции без ответов)")
  if (!/(components|schemas)\s*:/.test(t)) errors.push("нет components/schemas (DTO/Error не описаны)")
}

// Маркер заморозки: apidesigner ставит `x-frozen` (значение — true/дата/подпись).
if (!/x-frozen\s*:/.test(t)) {
  errors.push("нет маркера заморозки `x-frozen:` — контракт не заморожен (wirth-apidesigner его не проставил)")
}

if (errors.length) {
  console.error(`validate-contract-frozen: контракт НЕ готов (${path}):`)
  for (const e of errors) console.error(`  ✗ ${e}`)
  process.exit(1)
}
console.log(`validate-contract-frozen: OK — контракт полон и заморожен (${isAsync ? "AsyncAPI" : "OpenAPI"}, x-frozen)`)
