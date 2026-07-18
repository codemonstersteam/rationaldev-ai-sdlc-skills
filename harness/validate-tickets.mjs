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
//   outputs: [internal/catalog/logic.go, internal/catalog/logic_test.go]  # непустой; артефакты тикета
//   io: file                # только для type: module
//   skills: [db-io, db-schema]
//   ---
// inputs проверяются на существование (апстрим-артефакты). outputs — НЕ здесь: их производит сам тикет
// (на Gate #1 их ещё нет), наличие сверяет guardrail-poka-yoke на записи done.log-маркера.
//
// Запуск: node harness/validate-tickets.mjs [ticketsDir] [projectRoot]
// exit 0 = валидны; exit 1 = проблемы (stderr).
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join, isAbsolute } from "node:path"
import { parseFrontmatter } from "./frontmatter.mjs"
import { validateTicketHeaders } from "./lib/validators.mjs"
import { discoverTicketFiles } from "./lib/ticket-fs.mjs"

const root = process.argv[3] || process.cwd()
// Тикеты живут per slice: greenfield docs/design/slice-<name>/tickets/ + change-scoped
// docs/design/slice-<name>/changes/<slug>/tickets/ (доработка не затирает сборку). Явный каталог
// аргументом — точечная проверка; иначе собираем по всем слайсам (оба вида) через ticket-fs.
const explicit = process.argv[2]
const ticketFiles = explicit
  ? (existsSync(explicit) ? readdirSync(explicit).filter((f) => f.endsWith(".md")).sort().map((f) => ({ rel: f, abs: join(explicit, f) }))
     : (console.error(`validate-tickets: нет каталога тикетов ${explicit}`), process.exit(1)))
  : discoverTicketFiles(root)
if (!ticketFiles.length) { console.error(`validate-tickets: не найдено тикетов (docs/design/slice-*/tickets|changes/*/tickets/*.md)`); process.exit(1) }

const tickets = ticketFiles.map(({ rel, abs }) => ({ name: rel, data: parseFrontmatter(readFileSync(abs, "utf8")).data }))
// rework-режим (маркер от wirth-triage): в rework scaffold-тикет недопустим (правим существующее)
const rework = (() => { try { return readFileSync(join(root, ".agent", "planner", "mode"), "utf8").trim().startsWith("rework") } catch { return false } })()
const errors = validateTicketHeaders(tickets, { rework }) // структура + ссылки + scaffold (greenfield=1 / rework=0)

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
console.log(`validate-tickets: OK — ${tickets.length} тикетов, заголовки валидны, blocked_by/inputs целы, scaffold один`)
