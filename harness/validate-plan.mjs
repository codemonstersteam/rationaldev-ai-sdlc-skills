// CLI-оболочка (I/O) валидатора ПЛАНА как целого. Логика — в lib/validators.mjs
// (validatePlan, чисто). Забирает у LLM-ревьювера (mills) механические межтикетные
// проверки, которые validate-tickets (заголовок-в-одиночку) не делает:
//   • граф blocked_by — цикл-free DAG;
//   • scaffold — корень, всё транзитивно зависит от него; module — после component (RED-first);
//   • DoD-замыкание — каждый пункт TASK §Definition of done принадлежит sink-тикету (DoD-N).
//
// Запуск: node harness/validate-plan.mjs [ticketsDir] [projectRoot]
//   ticketsDir опционален (точечная проверка одного среза); иначе — все docs/design/slice-*/tickets.
//   projectRoot — где лежит TASK.md (по умолчанию cwd).
// exit 0 = план целостен; exit 1 = проблемы (stderr).
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import { parseFrontmatter } from "./frontmatter.mjs"
import { validatePlan, validateFeasibility, validateTypeDependencies, parseDodNumbers } from "./lib/validators.mjs"
import { discoverTicketFiles } from "./lib/ticket-fs.mjs"

const root = process.argv[3] || process.cwd()
const explicit = process.argv[2]

// greenfield slice-*/tickets/ + change-scoped slice-*/changes/*/tickets/ (см. lib/ticket-fs.mjs).
const ticketFiles = explicit
  ? (existsSync(explicit) ? readdirSync(explicit).filter((f) => f.endsWith(".md")).sort().map((f) => ({ rel: f, abs: join(explicit, f) }))
     : (console.error(`validate-plan: нет каталога тикетов ${explicit}`), process.exit(1)))
  : discoverTicketFiles(root)
if (!ticketFiles.length) { console.error("validate-plan: не найдено тикетов (docs/design/slice-*/tickets|changes/*/tickets/*.md)"); process.exit(1) }

const tickets = ticketFiles.map(({ rel, abs }) => {
  const { data, body } = parseFrontmatter(readFileSync(abs, "utf8"))
  return { name: rel, data, body }
})

// Номера пунктов TASK §Definition of done (для DoD-замыкания). Нет TASK / нет секции → [] (проверка пропускается).
const taskPath = join(root, "TASK.md")
const dodNumbers = existsSync(taskPath) ? parseDodNumbers(readFileSync(taskPath, "utf8")) : []

const errors = [...validatePlan(tickets, dodNumbers), ...validateFeasibility(tickets), ...validateTypeDependencies(tickets)]
if (errors.length) {
  console.error("validate-plan: ПЛАН НЕЦЕЛОСТЕН (граф/порядок/DoD-замыкание/feasibility):")
  for (const e of errors) console.error(`  ✗ ${e}`)
  process.exit(1)
}
const dod = dodNumbers.length ? `, DoD-замыкание ${dodNumbers.length}/${dodNumbers.length}` : ", DoD пропущен (нет TASK §DoD)"
console.log(`validate-plan: OK — граф blocked_by ацикличен, scaffold-корень, module после component, data-deps типов${dod} (${tickets.length} тикетов)`)
