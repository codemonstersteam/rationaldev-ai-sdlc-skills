// Детерминированный валидатор заголовков тикетов — гарантирует, что izi может роутить
// МЕХАНИЧЕСКИ (без чтения тела тикета и без догадок). Ошибка здесь = blocker до Gate #1.
//
// Каждый tickets/NN-*.md обязан иметь YAML-заголовок (flow-массивы, парсер поддерживает [a, b]):
//   ---
//   id: 05
//   type: module            # scaffold | component | module
//   slice: slice-02-catalog
//   blocked_by: [01, 04]    # id тикетов-предшественников (можно [])
//   inputs: [docs/design/slice-02-catalog/contracts.md, api-specification/openapi.yaml]
//   io: file                # только для type: module — none|http|llm|queue|db
//   skills: [db-io, db-schema]
//   ---
//
// Запуск: node harness/validate-tickets.mjs [ticketsDir] [projectRoot]
//   по умолчанию ticketsDir = <projectRoot>/.agent/planner/tickets, projectRoot = cwd.
// exit 0 = все заголовки валидны; exit 1 = список проблем на stderr.
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join, dirname, isAbsolute } from "node:path"
import { fileURLToPath } from "node:url"
import { parseFrontmatter } from "./frontmatter.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const root = process.argv[3] || process.cwd()
const dir = process.argv[2] || join(root, ".agent", "planner", "tickets")
const TYPES = new Set(["scaffold", "component", "module"])
const IOS = new Set(["none", "http", "llm", "queue", "db"])
const normId = (x) => String(x).trim().replace(/^0+(?=\d)/, "") // 05 == 5

if (!existsSync(dir)) { console.error(`validate-tickets: нет каталога тикетов ${dir}`); process.exit(1) }
const files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort()
if (!files.length) { console.error(`validate-tickets: в ${dir} нет тикетов`); process.exit(1) }

const errors = []
const ids = new Set()
const parsed = []
for (const f of files) {
  const { data } = parseFrontmatter(readFileSync(join(dir, f), "utf8"))
  if (!data) { errors.push(`${f}: нет YAML-заголовка (--- ... ---)`); continue }
  parsed.push({ f, data })
  if (data.id === undefined) errors.push(`${f}: нет поля id`)
  else ids.add(normId(data.id))
  if (!TYPES.has(data.type)) errors.push(`${f}: type='${data.type ?? "—"}' (ожидается scaffold|component|module)`)
  if (!Array.isArray(data.blocked_by)) errors.push(`${f}: blocked_by должен быть flow-списком [id, …] (можно [])`)
  if (!Array.isArray(data.inputs)) errors.push(`${f}: inputs должен быть flow-списком путей [a, b]`)
  if (data.type === "module" && !IOS.has(data.io)) errors.push(`${f}: type: module без валидного io: (none|http|llm|queue|db)`)
}
for (const { f, data } of parsed) {
  for (const b of Array.isArray(data.blocked_by) ? data.blocked_by : []) {
    if (!ids.has(normId(b))) errors.push(`${f}: blocked_by ссылается на несуществующий тикет '${b}'`)
  }
  for (const p of Array.isArray(data.inputs) ? data.inputs : []) {
    const abs = isAbsolute(p) ? p : join(root, p)
    if (!existsSync(abs)) errors.push(`${f}: inputs-путь не существует: ${p}`)
  }
}
const scaffold = parsed.filter((p) => p.data.type === "scaffold")
if (scaffold.length !== 1) errors.push(`ожидался ровно ОДИН scaffold-тикет, найдено ${scaffold.length}`)

if (errors.length) {
  console.error("validate-tickets: НЕВАЛИДНЫЕ заголовки тикетов (izi не сможет роутить механически):")
  for (const e of errors) console.error(`  ✗ ${e}`)
  process.exit(1)
}
console.log(`validate-tickets: OK — ${files.length} тикетов, заголовки валидны, blocked_by/inputs целы, scaffold один`)
