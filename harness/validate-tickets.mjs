// CLI-оболочка (I/O) валидатора тикетов. Структурная логика — в lib/validators.mjs
// (validateTicketHeaders, чисто). Существование inputs-путей — I/O, проверяется здесь.
// Гарантирует, что izi роутит МЕХАНИЧЕСКИ по заголовку (type/blocked_by/inputs).
//
// Заголовок тикета (flow-массивы — парсер поддерживает [a, b]):
//   ---
//   id: 05
//   type: module            # scaffold | component | module
//   slice: slice-02-catalog
//   blocked_by: [01, 04]
//   inputs: [docs/design/slice-02-catalog/contracts.md, api-specification/openapi.yaml]
//   io: file                # только для type: module
//   skills: [db-io, db-schema]
//   ---
//
// Запуск: node harness/validate-tickets.mjs [ticketsDir] [projectRoot]
// exit 0 = валидны; exit 1 = проблемы (stderr).
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join, isAbsolute } from "node:path"
import { parseFrontmatter } from "./frontmatter.mjs"
import { validateTicketHeaders } from "./lib/validators.mjs"

const root = process.argv[3] || process.cwd()
const dir = process.argv[2] || join(root, ".agent", "planner", "tickets")
if (!existsSync(dir)) { console.error(`validate-tickets: нет каталога тикетов ${dir}`); process.exit(1) }
const files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort()
if (!files.length) { console.error(`validate-tickets: в ${dir} нет тикетов`); process.exit(1) }

const tickets = files.map((name) => ({ name, data: parseFrontmatter(readFileSync(join(dir, name), "utf8")).data }))
const errors = validateTicketHeaders(tickets) // структура + ссылки + один scaffold (чисто)

// I/O-часть: inputs-пути должны существовать (это не логика — файловая система).
for (const { name, data } of tickets) {
  if (!data || !Array.isArray(data.inputs)) continue
  for (const p of data.inputs) {
    const abs = isAbsolute(p) ? p : join(root, p)
    if (!existsSync(abs)) errors.push(`${name}: inputs-путь не существует: ${p}`)
  }
}

if (errors.length) {
  console.error("validate-tickets: НЕВАЛИДНЫЕ заголовки тикетов (izi не сможет роутить механически):")
  for (const e of errors) console.error(`  ✗ ${e}`)
  process.exit(1)
}
console.log(`validate-tickets: OK — ${files.length} тикетов, заголовки валидны, blocked_by/inputs целы, scaffold один`)
