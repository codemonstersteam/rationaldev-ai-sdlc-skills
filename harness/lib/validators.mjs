// Чистые ядра валидаторов харнеса (io: none) — только логика text/данные → errors[].
// I/O (чтение файлов, существование путей) остаётся в CLI-оболочках (validate-*.mjs).
// Так модули харнеса сами следуют правилу: логика юнит-тестируема, I/O — компонентными.

const TICKET_TYPES = new Set(["scaffold", "component", "module"])
const IO_KINDS = new Set(["none", "http", "llm", "queue", "db"])
export const normId = (x) => String(x).trim().replace(/^0+(?=\d)/, "") // 05 == 5

// io-роутер как ИСПОЛНИМАЯ функция: (type, io) → точный набор скиллов тикета.
// Ядро имплементера (program-implementation/code-style/communication/memory) грузится
// всегда — здесь только add-on'ы «под тикет», ровно те, что имплементер обязан получить.
// null → набор не определён (невалидный type/io ловит отдельная проверка).
export function expectedTicketSkills(type, io) {
  if (type === "scaffold") return ["service-scaffold"]
  if (type === "component") return ["component-tests"]
  if (type === "module") {
    switch (io) {
      case "http": return ["http-io"]
      case "llm": return ["http-io", "llm-client"]
      case "queue": return ["queue-io"]
      case "db": return ["db-io", "db-schema"]
      case "none": return []
      default: return null
    }
  }
  return null
}
const sameSet = (a, b) => a.length === b.length && [...a].sort().join(",") === [...b].sort().join(",")

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
    // «Имплементер получает ровно нужный скилл»: skills: тикета обязан совпадать
    // с выводом io-роутера для его type/io — ни лишних, ни недостающих.
    if (!Array.isArray(data.skills)) {
      errors.push(`${name}: skills должен быть flow-списком [a, b] (можно [])`)
    } else {
      const exp = expectedTicketSkills(data.type, data.io)
      if (exp && !sameSet(data.skills, exp)) {
        errors.push(`${name}: skills=[${data.skills.join(", ")}] ≠ io-роутер [${exp.join(", ")}] ` +
          `(type=${data.type}, io=${data.io ?? "—"}) — имплементер должен получить РОВНО нужные скиллы`)
      }
    }
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

// --- Против переусложнения декомпозиции (harden-decomposition) ---------------
// Псевдо-UC/срез = framework (405/404) / boot (config/startup) / generic-error (internal) /
// тип-тикета (scaffold) — это НЕ user-goal и НЕ внешний вход. По Кокборну: один запрос = один
// use case, отказы = Extensions; по vertical-slices: 1 срез = 1 внешний вход (endpoint).
const PSEUDO_UC = /method[\s-]?not[\s-]?allowed|unknown[\s-]?route|route[\s-]?not[\s-]?found|internal[\s-]?error|start\s?up|fail[\s-]?fast|invalid config|config.*(fail|invalid)|bad request|invalid.*(sort|input|param)/i
const PSEUDO_SLICE = /scaffold|method[\s-]?not[\s-]?allowed|unknown[\s-]?route|not[\s-]?found|fail[\s-]?fast|config|internal[\s-]?error|\b40[45]\b/i

// #operations контракта = HTTP-метод-ключи под paths: (грубо, но детерминированно).
export function countOpenapiOperations(openapiText) {
  const t = String(openapiText).replace(/\r\n/g, "\n")
  const after = t.split(/^paths:[ \t]*$/m)[1]
  if (!after) return 0
  const block = after.split(/\n(?=\S)/)[0] // до следующего top-level ключа
  return (block.match(/^[ \t]+(get|post|put|delete|patch|head|options):/gim) || []).length
}

// UC в FRD, которые суть framework/boot/generic-error → должны быть Extensions, не top-level UC.
export function validateFrdUseCases(frdText) {
  const errors = []
  for (const m of String(frdText).matchAll(/^#{2,4}\s+UC[\s-]?\d+\s*[:—-]?\s*(.+)$/gim)) {
    const title = (m[1] || "").trim()
    if (PSEUDO_UC.test(title)) {
      errors.push(`UC «${title}» — framework/boot/generic-error, не user-goal use case; ` +
        `сделай Extension'ом (Кокборн: один внешний запрос = один UC, отказы = Extensions)`)
    }
  }
  return errors
}

// Срезов не больше, чем operations контракта; и никаких псевдо-срезов.
export function validateSlices(slicesText, openapiText) {
  const errors = []
  const ops = countOpenapiOperations(openapiText || "")
  // срезы: заголовки "## Slice <NN>" (с номером — не путать с "## Slice inventory")
  // либо уникальные имена slice-<name>
  let n = (slicesText.match(/^##\s+Slice[\s-]?\d/gim) || []).length
  if (!n) n = new Set([...slicesText.matchAll(/\bslice-[a-z0-9-]+/gi)].map((x) => x[0].toLowerCase())).size
  if (ops > 0 && n > ops) {
    errors.push(`срезов ${n} > operations контракта ${ops} — переусложнение ` +
      `(1 внешний вход = 1 срез; отказы/framework/boot — Extensions, не срезы). Слить лишние.`)
  }
  // псевдо-срезы по заголовку и по имени папки
  for (const m of slicesText.matchAll(/^##\s+Slice\s+\S+\s*[:—-]?\s*(.+)$/gim)) {
    const name = (m[1] || "").trim()
    if (PSEUDO_SLICE.test(name)) errors.push(`псевдо-срез «${name}» — framework/boot/тип-тикета, не внешний вход контракта`)
  }
  for (const m of slicesText.matchAll(/\bslice-[a-z0-9-]+/gi)) {
    if (PSEUDO_SLICE.test(m[0])) errors.push(`псевдо-срез «${m[0]}» — не отдельный внешний вход`)
  }
  return [...new Set(errors)]
}

// --- Mermaid C4: синтаксис-линт (валидность рендера без тяжёлого движка) -------
// Ловит частый провал: C4-диаграмма написана UML/PlantUML-синтаксисом (<<component>>,
// bare [LABEL]) вместо Mermaid-C4 функций (Component()/Rel()/Container_Boundary(){}) → «Syntax error».
const C4_HEADER = /^(C4Context|C4Container|C4Component|C4Dynamic|C4Deployment)\b/
const C4_STMT = new RegExp(
  "^\\s*(Person|Person_Ext|System|System_Ext|SystemDb|SystemDb_Ext|SystemQueue|Container|Container_Ext|" +
  "ContainerDb|ContainerDb_Ext|ContainerQueue|Component|Component_Ext|ComponentDb|ComponentQueue|" +
  "Boundary|Enterprise_Boundary|System_Boundary|Container_Boundary|Node|Node_L|Node_R|Deployment_Node|" +
  "Rel|BiRel|Rel_U|Rel_D|Rel_L|Rel_R|Rel_Up|Rel_Down|Rel_Left|Rel_Right|Rel_Back|" +
  "UpdateElementStyle|UpdateRelStyle|UpdateLayoutConfig|UpdateBoundaryStyle|title)\\b" +
  "|^\\s*[{}]\\s*$|^\\s*%%|^\\s*$",
)

// Извлечь ```mermaid блоки из markdown.
function mermaidBlocks(md) {
  const out = []
  const re = /```mermaid\s*\n([\s\S]*?)```/gi
  let m
  while ((m = re.exec(String(md)))) out.push(m[1])
  return out
}

// Известные типы диаграмм Mermaid — блок обязан начинаться с одного из них.
const MERMAID_HEADER = /^(C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|quadrantChart|requirementDiagram|gitGraph|sankey(-beta)?|xychart(-beta)?|block(-beta)?)\b/

export function validateMermaid(md) {
  const errors = []
  const blocks = mermaidBlocks(md)
  blocks.forEach((block, bi) => {
    const lines = block.split("\n")
    const first = (lines.find((l) => l.trim()) || "").trim()
    const isC4 = C4_HEADER.test(first)
    // (1) каждый блок обязан объявить тип диаграммы первой непустой строкой
    if (!MERMAID_HEADER.test(first)) {
      errors.push(`mermaid[${bi + 1}]: нет объявления типа диаграммы (первая строка «${first.slice(0, 40)}») — ` +
        `Mermaid требует C4Component/flowchart/… первой строкой`)
    }
    lines.forEach((line, li) => {
      const t = line.trim()
      if (!t) return
      // (2) UML/PlantUML-стереотипы `<<...>>` не рендерятся Mermaid ни в какой диаграмме
      if (/<<[^>]*>>/.test(line)) {
        errors.push(`mermaid[${bi + 1}] строка ${li + 1}: UML-стереотип «${t.slice(0, 40)}» — не Mermaid ` +
          `(в C4 используй функции Component()/System_Ext()/Rel(), не <<...>>)`)
      } else if (isC4 && !C4_HEADER.test(t) && !C4_STMT.test(line)) {
        // (3) внутри C4-блока — только валидные C4-стейтменты
        errors.push(`mermaid[${bi + 1}] строка ${li + 1}: «${t.slice(0, 40)}» — не валидный C4-стейтмент ` +
          `(ожидается Component/Container/Rel/..._Boundary/{ }); копируй шаблон c4, не выдумывай синтаксис`)
      }
    })
  })
  return errors
}
