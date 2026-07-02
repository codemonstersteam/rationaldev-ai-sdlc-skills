// Чистые ядра валидаторов харнеса (io: none) — только логика text/данные → errors[].
// I/O (чтение файлов, существование путей) остаётся в CLI-оболочках (validate-*.mjs).
// Так модули харнеса сами следуют правилу: логика юнит-тестируема, I/O — компонентными.

const TICKET_TYPES = new Set(["scaffold", "component", "module"])
const IO_KINDS = new Set(["none", "http", "llm", "queue", "db"])
export const normId = (x) => String(x).trim().replace(/^0+(?=\d)/, "") // 05 == 5

// --- FRD: структурная полнота по handoff-чеклисту requirements-intake ---
export function validateFrd(text) {
  text = String(text).replace(/\r\n/g, "\n")
  const low = text.toLowerCase()
  const headings = text.split("\n").filter((l) => /^#{1,6}\s/.test(l)).map((l) => l.toLowerCase())
  const has = (re) => headings.some((h) => re.test(h)) || re.test(low)
  const REQUIRED = [
    ["problem statement / постановка", /problem statement|постановка задачи|проблем/],
    ["actors & external systems / акторы", /actors?|акторы|внешние систем/],
    ["use cases (Cockburn)", /use[ -]?cases?|сценари(и|й)/],
    ["contract (draft) / контракт", /contract|контракт|openapi|asyncapi|api/],
    ["failure-mode map / карта отказов", /failure[- ]?mode|карта .*отказ|режим.*отказ|error|ошибк/],
  ]
  const errors = []
  for (const [label, re] of REQUIRED) if (!has(re)) errors.push(`нет секции: ${label}`)
  if (!/extensions?|расширени|альтернатив|\bNNa\b|\b\d+a\b/i.test(text)) {
    errors.push("нет Extensions в use-cases (нет ветвей отказа → нечего покрывать компонентными)")
  }
  return errors
}

// --- Контракт: полнота OpenAPI/AsyncAPI + маркер заморозки x-frozen ---
export function validateContractFrozen(text) {
  text = String(text).replace(/\r\n/g, "\n")
  const errors = []
  const isAsync = /asyncapi\s*:/.test(text)
  if (isAsync) {
    if (!/^\s*asyncapi\s*:/m.test(text)) errors.push("нет поля asyncapi:")
    if (!/^\s*channels\s*:/m.test(text)) errors.push("нет channels: (ни одного канала)")
    if (!/^\s*(components|messages)\s*:/m.test(text)) errors.push("нет messages/components (схемы сообщений)")
  } else {
    if (!/^\s*openapi\s*:/m.test(text)) errors.push("нет поля openapi: (не OpenAPI-документ)")
    if (!/^\s*paths\s*:/m.test(text)) errors.push("нет paths:")
    else if (!/^\s{2,}\/\S/m.test(text)) errors.push("paths: пуст — ни одного эндпоинта")
    if (!/responses\s*:/.test(text)) errors.push("нет responses: (операции без ответов)")
    if (!/(components|schemas)\s*:/.test(text)) errors.push("нет components/schemas (DTO/Error не описаны)")
  }
  if (!/x-frozen\s*:/.test(text)) {
    errors.push("нет маркера заморозки `x-frozen:` — контракт не заморожен")
  }
  return errors
}

// --- Заголовки тикетов: структура + перекрёстные ссылки + один scaffold ---
// tickets: [{ name, data }] — data = распарсенный frontmatter (или null). Чисто: без fs.
// Существование inputs-путей проверяет CLI-оболочка (это I/O).
export function validateTicketHeaders(tickets) {
  const errors = []
  const ids = new Set()
  for (const { name, data } of tickets) {
    if (!data) { errors.push(`${name}: нет YAML-заголовка (--- ... ---)`); continue }
    if (data.id === undefined) errors.push(`${name}: нет поля id`)
    else ids.add(normId(data.id))
    if (!TICKET_TYPES.has(data.type)) errors.push(`${name}: type='${data.type ?? "—"}' (ожидается scaffold|component|module)`)
    if (!Array.isArray(data.blocked_by)) errors.push(`${name}: blocked_by должен быть flow-списком [id, …] (можно [])`)
    if (!Array.isArray(data.inputs)) errors.push(`${name}: inputs должен быть flow-списком путей [a, b]`)
    if (data.type === "module" && !IO_KINDS.has(data.io)) errors.push(`${name}: type: module без валидного io: (none|http|llm|queue|db)`)
  }
  for (const { name, data } of tickets) {
    if (!data) continue
    for (const b of Array.isArray(data.blocked_by) ? data.blocked_by : []) {
      if (!ids.has(normId(b))) errors.push(`${name}: blocked_by ссылается на несуществующий тикет '${b}'`)
    }
  }
  const scaffold = tickets.filter((t) => t.data && t.data.type === "scaffold")
  if (scaffold.length !== 1) errors.push(`ожидался ровно ОДИН scaffold-тикет, найдено ${scaffold.length}`)
  return errors
}
