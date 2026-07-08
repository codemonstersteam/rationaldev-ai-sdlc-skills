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
    // outputs: артефакты, которые ПРОИЗВОДИТ тикет (машиночитаемо). Существование — не здесь: на Gate #1
    // их ещё нет, наличие сверяет guardrail-poka-yoke на done-маркере. Здесь только структура: непустой список.
    if (!Array.isArray(data.outputs)) errors.push(`${name}: outputs должен быть flow-списком путей [a, b] — артефакты, которые тикет производит (poka-yoke сверяет их наличие на done-маркере)`)
    else if (data.outputs.length === 0) errors.push(`${name}: outputs пуст — тикет обязан объявить ≥1 производимый артефакт (иначе poka-yoke нечего проверять)`)
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

// --- T06 feasibility: тикет-контракт выполним конкретной ролью (ловит постановочные ошибки на Gate #1) ---
// Механизирует манифест-правила (T10 scaffold cmd/app · split-final single-concern) в детерминированный гейт.
// tickets: [{ name, data }] — data.type, data.outputs. Чисто: без fs.
// «Тяжёлый» concern пути (не logic-модуль): wiring (register.go) · docs (README) · deploy (Docker/compose/run-tests).
function heavyConcern(p) {
  if (/(?:^|\/)register\.go$/.test(p)) return "wiring"
  if (/(?:^|\/)README(?:\.[a-z]+)?$/i.test(p)) return "docs"
  if (/(?:^|\/)(?:Dockerfile|docker-compose\.ya?ml|run-tests\.sh)$/.test(p)) return "deploy"
  return null // logic .go, конфиги, fixtures — не «тяжёлые», не конфликтуют
}
export function validateFeasibility(tickets) {
  const errors = []
  for (const { name, data } of tickets) {
    if (!data || !Array.isArray(data.outputs)) continue
    // (1) scaffold cmd = ТОЛЬКО cmd/app (scaffold.sh не переименовывает cmd-дир; ловит выдуманный cmd/<slug> — T10).
    if (data.type === "scaffold") {
      for (const p of data.outputs) {
        const m = p.match(/(?:^|\/)cmd\/([^/]+)\//)
        if (m && m[1] !== "app")
          errors.push(`${name}: scaffold объявляет 'cmd/${m[1]}/' — scaffold.sh даёт 'cmd/app/' (cmd-дир не переименовывает); ` +
            `slice-имя bin не выдумывать (см. T10)`)
      }
      continue // scaffold сеет скелет+boilerplate (в т.ч. Docker) — single-concern к нему не применяем
    }
    // (2) single-concern: не мешать wiring/docs/deploy в одном тикете (это и есть «толстый final» — split-final/T12).
    const heavy = new Set(data.outputs.map(heavyConcern).filter(Boolean))
    if (heavy.size > 1)
      errors.push(`${name}: тикет смешивает разные шаги конвейера в outputs (${[...heavy].sort().join("+")}) — ` +
        `раздели: wiring · README · deploy — свои тикеты, final замыкает @linger (см. split-final)`)
  }
  return errors
}

// Номера пунктов TASK §Definition of done (нумерованный список под заголовком). Чисто.
// Построчно (не одним regex: `$` под флагом m обрывал бы секцию на первом переносе).
export function parseDodNumbers(taskText) {
  const lines = String(taskText).replace(/\r\n/g, "\n").split("\n")
  let i = lines.findIndex((l) => /^#{1,6}[ \t]*Definition of done\b/i.test(l))
  if (i < 0) return []
  const nums = new Set()
  for (i++; i < lines.length; i++) {
    if (/^#{1,6}[ \t]/.test(lines[i])) break // следующий заголовок — конец секции
    const g = lines[i].match(/^\s*(\d+)\.\s/)
    if (g) nums.add(Number(g[1]))
  }
  return [...nums].sort((a, b) => a - b)
}

// --- План как целое: граф зависимостей (DAG без циклов) + порядок + DoD-замыкание ---
// Забирает у LLM-ревьювера (mills) МЕХАНИЧЕСКИЕ межтикетные проверки, которые validate-tickets
// (заголовок-в-одиночку) не покрывает: цикл в blocked_by, scaffold-корень, component-before-module,
// и покрытие каждого пункта TASK §Definition of done тикетом-владельцем. Чисто: без fs.
//   tickets: [{ name, data, body }] — data = frontmatter, body = текст тикета (для DoD-N).
//   dodNumbers: number[] — номера пунктов TASK §Definition of done ([] → DoD-проверка пропускается).
// Допущение: один сервис/срез (текущий харнес). Ложный blocker хуже пропуска — проверки
// консервативны (нераспознанное = не ошибка).
export function validatePlan(tickets, dodNumbers = []) {
  const errors = []
  const valid = tickets.filter((t) => t.data && t.data.id !== undefined && Array.isArray(t.data.blocked_by))
  if (!valid.length) return errors // нечего проверять — заголовки ловит validate-tickets
  const byId = new Map(valid.map((t) => [normId(t.data.id), t]))
  const deps = (t) => t.data.blocked_by.map(normId).filter((b) => byId.has(b))

  // 1) DAG без циклов — DFS с тремя цветами; при цикле собираем путь
  const color = new Map([...byId.keys()].map((id) => [id, 0])) // 0=white 1=gray 2=black
  const stack = []
  let cycle = null
  const dfs = (id) => {
    color.set(id, 1); stack.push(id)
    for (const b of deps(byId.get(id))) {
      if (color.get(b) === 1) { cycle = [...stack.slice(stack.indexOf(b)), b]; return true }
      if (color.get(b) === 0 && dfs(b)) return true
    }
    color.set(id, 2); stack.pop(); return false
  }
  for (const id of byId.keys()) if (color.get(id) === 0 && dfs(id)) break
  if (cycle) { errors.push(`цикл в графе blocked_by: ${cycle.join(" → ")}`); return errors } // граф нецелостен — дальше бессмысленно

  // предок по blocked_by, удовлетворяющий pred?
  const reaches = (id, pred) => {
    const seen = new Set(), st = [...deps(byId.get(id))]
    while (st.length) {
      const c = st.pop(); if (seen.has(c)) continue; seen.add(c)
      if (pred(byId.get(c))) return true
      for (const b of deps(byId.get(c))) st.push(b)
    }
    return false
  }

  // 2) Порядок: scaffold-корень; всё транзитивно зависит от него; module — после component
  const scaffolds = valid.filter((t) => t.data.type === "scaffold")
  if (scaffolds.length === 1) {
    const sc = scaffolds[0], scId = normId(sc.data.id)
    if (deps(sc).length) errors.push(`${sc.name}: scaffold должен быть корнем (blocked_by: []), а не ${JSON.stringify(sc.data.blocked_by)}`)
    for (const t of valid) {
      const id = normId(t.data.id)
      if (id !== scId && !reaches(id, (a) => normId(a.data.id) === scId))
        errors.push(`${t.name}: не зависит транзитивно от scaffold (${sc.data.id}) — порядок нарушен`)
    }
  }
  if (valid.some((t) => t.data.type === "component"))
    for (const t of valid.filter((t) => t.data.type === "module"))
      if (!reaches(normId(t.data.id), (a) => a.data.type === "component"))
        errors.push(`${t.name}: module не зависит (транзитивно) от component-тикета — RED-first нарушен`)

  // 3) DoD-замыкание: sink-тикеты (никто не blocked_by них) обязаны покрыть все пункты TASK §DoD
  if (dodNumbers.length) {
    const blocked = new Set(valid.flatMap(deps))
    const sinks = valid.filter((t) => !blocked.has(normId(t.data.id)))
    const covered = new Set()
    for (const t of sinks) for (const m of String(t.body || "").matchAll(/\bDoD[-\s]?(\d+)\b/gi)) covered.add(Number(m[1]))
    if (!covered.size) errors.push("финальный тикет не замыкает DoD: ни один sink-тикет не ссылается на пункты TASK §Definition of done (DoD-N)")
    else {
      const missing = dodNumbers.filter((n) => !covered.has(n))
      if (missing.length) errors.push(`DoD-замыкание неполно — пункты TASK §Definition of done без владельца-тикета: ${missing.map((n) => "DoD-" + n).join(", ")}`)
    }
  }
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

// --- Slice-aligned раскладка (slice-aligned-code-layout) -----------------------
// Каждый code-путь под internal/ обязан лежать под internal/<slug>/ ОБЪЯВЛЕННОГО среза
// ИЛИ под internal/shared/ (kernel для типов ≥2 срзов). Layer-keyed корень (техническая
// роль: io/cli/domain/httpapi/catalog/storage/config/…) = blocker — вертикальная граница
// среза потеряна. Чисто: (paths, slugs) → errors[]. Забирает у mills механическую проверку
// «раскладка по срезу — ALWAYS» ([[mills-mechanical-vs-semantic]]).
// Консервативно: без slugs ловим только заведомо layer-keyed набор (ложный blocker хуже пропуска).
const LAYER_KEYED = new Set([
  "io", "cli", "domain", "httpapi", "catalog", "storage", "config",
  "handlers", "handler", "service", "services", "repo", "repository", "dao",
  "models", "model", "usecase", "usecases", "infra", "infrastructure",
  "adapter", "adapters", "controller", "controllers", "api", "transport",
])

export function validateLayout(paths, slugs = []) {
  const errors = []
  // slug нормализуем: срезаем docs-префикс slice- (docs/design/slice-<name> ↔ internal/<name>)
  const declared = new Set(slugs.map((s) => String(s).trim().toLowerCase().replace(/^slice-/, "")).filter(Boolean))
  const seen = new Set()
  for (const raw of paths) {
    const p = String(raw).trim().replace(/^["'`]+|["'`]+$/g, "").replace(/^\.?\//, "")
    const m = p.match(/^internal\/([a-z0-9_-]+)\//i)
    if (!m) continue // не под internal/<x>/ (cmd/, docs/, internal/<file> без подпапки) — не slice-scoped
    const root = m[1].toLowerCase()
    if (root === "shared") continue // явный kernel — разрешён
    if (declared.has(root)) continue // под объявленным срезом — разрешён
    if (seen.has(root)) continue // одна ошибка на корень, не на каждый путь
    seen.add(root)
    if (LAYER_KEYED.has(root)) {
      errors.push(`layer-keyed корень internal/${root}/ — раскладка по технической роли, не по срезу ` +
        `(код среза → internal/<slug>/; общее ≥2 срезов → internal/shared/)`)
    } else if (declared.size) {
      errors.push(`internal/${root}/ не объявлен ни одним срезом (Owns package) и не internal/shared/ — ` +
        `вертикальная граница среза потеряна`)
    }
    // else: slugs не переданы и root не layer-keyed — не блокируем (консервативно)
  }
  return errors
}

// Declaration-mode (рунг 1 shift-left): слайсер ОБЯЗАН объявить границу пакета КАЖДОГО среза
// (`Owns package: internal/<slug>/`) ещё до дизайна — тогда moduledesigner входит в стадию с уже
// названной границей и не сваливается в layer-keyed по умолчанию. Проверяет НАЛИЧИЕ + форму поля,
// не пути (пути наполняет program-design → там paths-mode validateLayout). Чисто: (slicesText) → errors[].
export function validateSliceDeclarations(slicesText) {
  const errors = []
  const text = String(slicesText).replace(/\r\n/g, "\n")
  // H2-секции; секция среза = заголовок "## Slice <…с цифрой…>" (как в validateSlices), не "## Slice inventory"
  for (const sec of text.split(/^(?=##\s)/m)) {
    const h = sec.match(/^##\s+Slice[\s-]?(\S+)/i)
    if (!h || !/\d/.test(h[1])) continue
    const label = `Slice ${h[1].replace(/[:—-]+$/, "")}`
    const om = sec.match(/Owns package:\s*`?\s*([^\s`]+)/i)
    if (!om) { errors.push(`${label}: нет поля Owns package: internal/<slug>/ — граница пакета не объявлена`); continue }
    const vm = om[1].replace(/\/+$/, "").match(/^internal\/([a-z0-9_-]+)$/i)
    if (!vm) { errors.push(`${label}: Owns package '${om[1]}' не вида internal/<slug>/`); continue }
    if (LAYER_KEYED.has(vm[1].toLowerCase()))
      errors.push(`${label}: Owns package internal/${vm[1]}/ — layer-keyed корень (техническая роль), не имя среза`)
  }
  return errors
}

// --- Карта контекстов (domain-context-adr-layout, Ф4) --------------------------
// Мягкий гейт: при ≥2 CONTEXT.md — root CONTEXT-MAP.md существует, его ссылки резолвятся,
// есть секция Relationships, каждый контекст покрыт картой; ADR-нумерация последовательна
// (1..n, per dir). Консервативно — single-context не трогаем (ложный blocker хуже пропуска).
// Матчинг по slug (slice-<slug>/CONTEXT.md), устойчив к различию префиксов путей. Чисто.
//   contextPaths: string[] — найденные CONTEXT.md · mapText: root CONTEXT-MAP.md ("" если нет)
//   adrDirs: [{ dir, numbers: number[] }] — номера ADR по директориям
const ctxSlug = (p) => {
  const m = String(p).match(/slice-([a-z0-9_-]+)[/\\]CONTEXT\.md$/i)
  return m ? m[1].toLowerCase() : "root"
}
export function validateContextMap(contextPaths, mapText, adrDirs = []) {
  const errors = []
  const paths = (contextPaths || []).map(String)
  const map = String(mapText || "")
  const sliceSlugs = paths.map(ctxSlug).filter((s) => s !== "root")

  // 1) ≥2 CONTEXT.md → root CONTEXT-MAP.md обязан существовать
  if (paths.length >= 2 && !map.trim())
    errors.push(`≥2 CONTEXT.md (${paths.length}), но нет root CONTEXT-MAP.md — карта контекстов потеряна`)

  // 2) карта есть → Relationships + резолв ссылок + покрытие
  if (map.trim()) {
    if (!/^#{1,3}\s+Relationships\b/im.test(map))
      errors.push("CONTEXT-MAP.md: нет секции Relationships (связи контекстов не описаны)")
    const linkedSlugs = new Set([...map.matchAll(/\]\(([^)]*CONTEXT\.md)\)/gi)].map((m) => ctxSlug(m[1])))
    for (const s of linkedSlugs)
      if (s !== "root" && !sliceSlugs.includes(s))
        errors.push(`CONTEXT-MAP.md: ссылка на контекст '${s}' не резолвится (нет docs/design/slice-${s}/CONTEXT.md)`)
    if (paths.length >= 2)
      for (const s of new Set(sliceSlugs))
        if (!linkedSlugs.has(s))
          errors.push(`CONTEXT-MAP.md: контекст '${s}' не указан в карте (S3-покрытие: связь потеряна)`)
  }

  // 3) ADR-нумерация последовательна per dir: уникальные, 1..n без дыр
  for (const { dir, numbers } of adrDirs) {
    const ns = (numbers || []).slice().sort((a, b) => a - b)
    const uniq = [...new Set(ns)]
    if (uniq.length !== ns.length) {
      const dups = ns.filter((n, i) => i > 0 && n === ns[i - 1])
      errors.push(`${dir}: дубль ADR-номера ${[...new Set(dups)].join(", ")}`)
    }
    if (uniq.length && (uniq[0] !== 1 || uniq.some((n, i) => n !== i + 1)))
      errors.push(`${dir}: ADR-нумерация с дырой/не с 1 (${uniq.join(",")}; ожидалось ${uniq.map((_, i) => i + 1).join(",")})`)
  }
  return errors
}

// --- Компонентные тесты: защита ОРАКУЛА (предпосылка удешевления wirth-tester) --
// Тесты — оракул корректности среза, а их не проверяет никто механически. Этот гейт даёт
// механический backbone, чтобы realization можно было доверить слабой модели (Qwen): реализовано
// РОВНО столько сценариев, сколько спроектировано; все @wip (снятие = акт фиксера); smoke есть.
// RED-по-бизнес-причине и резолв step-def остаются семантике (@linger/@mills) — их тут НЕ ловим.
// Чисто: (feature, declaredN?) → errors[]. declaredN=null → сверка с дизайном пропускается (soft).
//   feature: { business: string[], wip: number, smoke: number }
export function validateComponentTests(feature, declaredN = null) {
  const errors = []
  const biz = (feature && feature.business) || []
  const wip = (feature && feature.wip) || 0
  const smoke = (feature && feature.smoke) || 0

  if (!biz.length) errors.push("нет бизнес-сценариев (.feature пуст кроме smoke) — покрытие не реализовано")
  if (smoke < 1) errors.push("нет smoke-сценария — обвязка компонентных тестов не доказана")
  if (wip < biz.length)
    errors.push(`не все сценарии @wip (${wip}/${biz.length}) — риск преждевременного green/гейминга (снятие @wip = акт фиксера, не автора)`)

  // дубль заголовков
  const seen = new Set(), dup = new Set()
  for (const t of biz) { const k = String(t).trim().toLowerCase(); if (seen.has(k)) dup.add(k); else seen.add(k) }
  if (dup.size) errors.push(`дубль сценария: ${[...dup].join("; ")}`)

  // нумерация (если сценарии пронумерованы «N. …») — 1..len без дыр/дублей: ловит пропущенный сценарий
  const nums = biz.map((t) => { const m = String(t).match(/^\s*(\d+)[.)]/); return m ? Number(m[1]) : null })
  if (biz.length && nums.every((x) => x != null)) {
    const uniq = [...new Set(nums)].sort((a, b) => a - b)
    if (uniq.length !== nums.length || uniq[0] !== 1 || uniq.some((n, i) => n !== i + 1))
      errors.push(`нумерация сценариев с дырой/дублем (${nums.join(",")}) — возможен пропущенный/лишний сценарий`)
  }

  // сверка с дизайном (если N извлечён из contracts.md): пропуск/выдумка сценария
  if (declaredN != null && biz.length !== declaredN)
    errors.push(`#сценариев ${biz.length} ≠ дизайн N=${declaredN} (формула 1+Σ) — пропущен или выдуман сценарий`)
  return errors
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

// --- valid-by-construction (program-design step-03) ------------------------------------------
// Каждый доменный value-object в Go: НЕэкспортируемые поля + единственная фабрика
// NewX(raw) -> (X, error), которая проверяет КАЖДОЕ поле; голый литерал X{...} вне NewX запрещён
// (Go-аналог приватного конструктора). wire-DTO (Raw*/…Request/…Response, поля с json:/yaml:-тегами)
// исключены — им экспортируемые поля нужны для (де)сериализации.
// Область — гибрид: domainTypes из module-tree (роли constructor/subtype), иначе эвристика ниже.
// Приблизительно (regex, не Go-AST): #3 ловит «поле вообще не упомянуто в фабрике», не «проверено криво».

const DTO_NAME = /^Raw|(Request|Response|DTO|Dto)$/
const INFRA_NAME = /(Store|Client|Publisher|Consumer|Gateway|Repository|Server|Handler|Adapter|Recorder|Logger|Config|Options|Deps|App|Router|Mux)$/
const structBody = (src, name) => {
  const m = new RegExp(`type\\s+${name}\\s+struct\\s*\\{`).exec(src)
  if (!m) return null
  let i = m.index + m[0].length, depth = 1, start = i
  for (; i < src.length && depth; i++) { if (src[i] === "{") depth++; else if (src[i] === "}") depth-- }
  return src.slice(start, i - 1)
}
const fieldsOf = (body) => body.split("\n").map((l) => l.replace(/\/\/.*$/, "").trim()).filter(Boolean)
  .map((l) => {
    const tag = /`[^`]*\b(json|yaml|xml):/.test(l)
    const mm = /^([A-Za-z_]\w*)(\s*,\s*[A-Za-z_]\w*)*\s+\S/.exec(l) // "name Type" (не встроенный тип)
    const names = mm ? l.slice(0, l.search(/\s+\S/)).split(",").map((s) => s.trim()) : [l.split(/\s+/)[0]]
    return { names, tag, embedded: !mm }
  })
const fnSpan = (src, fnName) => {
  const m = new RegExp(`func\\s+${fnName}\\s*\\(`).exec(src)
  if (!m) return null
  let i = src.indexOf("{", m.index); if (i < 0) return null
  const start = i; let depth = 0
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}" && --depth === 0) { i++; break } }
  return [start, i]
}
const lineAt = (src, idx) => src.slice(0, idx).split("\n").length

// files: [{ path, src }] (только *.go среза, без *_test.go). domainTypes: Set<string>|null (из module-tree).
export function validateConstructors(files, domainTypes = null) {
  const errors = []
  const all = files.map((f) => f.src).join("\n")
  const factories = new Set([...all.matchAll(/func\s+New(\w+)\s*\([^)]*\)\s*\(\s*(\w+)/g)]
    .filter((m) => m[1] === m[2]).map((m) => m[1])) // NewX -> (X, ...)
  const structNames = [...all.matchAll(/type\s+(\w+)\s+struct\s*\{/g)].map((m) => m[1])

  for (const name of structNames) {
    const body = structBody(all, name); if (body == null) continue
    const fields = fieldsOf(body)
    const hasTag = fields.some((f) => f.tag)
    // Область (гибрид). module-tree: доверяем ролям узлов (дизайн уже классифицировал). Эвристика (без
    // module-tree): только структуры, сами объявившие себя value-object'ом (есть NewX), не DTO и не инфра
    // (*Store/*Client/Deps/*Handler/…) — иначе не знаем намерения и ложно требуем фабрику у wiring/I/O.
    const inScope = domainTypes ? domainTypes.has(name)
      : (factories.has(name) && !DTO_NAME.test(name) && !INFRA_NAME.test(name) && !hasTag)
    if (!inScope) continue

    // #1 поля неэкспортируемые
    for (const f of fields) for (const n of f.names)
      if (/^[A-Z]/.test(n))
        errors.push(`${name}.${n} экспортируемое — доменный value-object обязан инкапсулировать поля (геттер), ` +
          `иначе снаружи пакета собирается невалидная структура`)
    // #2 фабрика есть — обязательна ТОЛЬКО когда module-tree назвал тип конструктор-узлом (иначе намерение неясно)
    if (!factories.has(name)) {
      if (domainTypes)
        errors.push(`${name} без фабрики New${name}(raw) -> (${name}, error) — не valid by construction (step-03)`)
      continue
    }
    // #3 фабрика реально валидирует (есть guard с возвратом ошибки), а не pass-through.
    // Полноту «каждое поле проверено» держит формула юнит-тестов в дизайне (ветвь на поле = unit);
    // регексом надёжно проверяем лишь наличие проверки как таковой (без ложных срабатываний на wrapper'ах).
    const span = fnSpan(all, `New${name}`)
    const fnBody = span ? all.slice(span[0], span[1]) : ""
    if (!/return\s+[\w.]*\{\s*\}\s*,/.test(fnBody))
      errors.push(`New${name} без проверки (нет ветки return ${name}{}, err) — фабрика-pass-through не валидирует ` +
        `диапазон; каждое поле обязано проверяться, ни одно не должно пройти без проверки`)
    // #4 голый НЕПУСТОЙ литерал X{поля...} вне тела фабрики. Пустой X{} — это zero-value на error-пути
    // (идиома `return X{}, err`), НЕ сборка в обход валидации → не флагаем (иначе ложное срабатывание).
    for (const f of files) {
      const s = fnSpan(f.src, `New${name}`)
      for (const m of f.src.matchAll(new RegExp(`\\b${name}\\{\\s*[^}\\s]`, "g"))) {
        const inside = s && m.index >= s[0] && m.index < s[1]
        if (!inside)
          errors.push(`голый литерал ${name}{...} в ${f.path}:${lineAt(f.src, m.index)} минует фабрику New${name} ` +
            `(строй только через New${name}, иначе инвариант не гарантирован)`)
      }
    }
  }
  return errors
}
