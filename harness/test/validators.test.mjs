// Юнит-тесты чистых ядер валидаторов (io: none). Формула: 1 happy + по ветке-blocker.
import { test } from "node:test"
import assert from "node:assert/strict"
import { validateFrd, validateContractFrozen, validateTicketHeaders, expectedTicketSkills, validateLayout, validateSliceDeclarations, validateContextMap, validateComponentTests } from "../lib/validators.mjs"

// --- validateFrd ---
const FRD_OK = `# svc — FRD
## Problem statement
одна фраза
## Actors & external systems
| client | HTTP |
## Use cases
### UC1
Extensions: 1a ошибка
## Contract (draft)
openapi skeleton
## Failure-mode map
| STORE_MISSING | 500 |
## NFR
## Open questions
`
test("validateFrd: полный FRD → нет ошибок", () => {
  assert.deepEqual(validateFrd(FRD_OK), [])
})
test("validateFrd: нет акторов → ошибка", () => {
  const errs = validateFrd(FRD_OK.replace(/## Actors & external systems[\s\S]*?## Use cases/, "## Use cases"))
  assert.ok(errs.some((e) => /actors/i.test(e)))
})
test("validateFrd: нет Extensions → ошибка", () => {
  const errs = validateFrd(FRD_OK.replace(/Extensions: 1a ошибка/, "просто шаги"))
  assert.ok(errs.some((e) => /Extensions/i.test(e)))
})

// --- validateContractFrozen ---
const OAS_OK = `openapi: 3.1.0
info:
  x-frozen: true
paths:
  /services:
    get:
      responses:
        '200':
          content: {}
components:
  schemas:
    Error: {}
`
test("validateContractFrozen: полный + x-frozen → нет ошибок", () => {
  assert.deepEqual(validateContractFrozen(OAS_OK), [])
})
test("validateContractFrozen: нет x-frozen → ошибка заморозки", () => {
  assert.ok(validateContractFrozen(OAS_OK.replace(/\s*x-frozen: true/, "")).some((e) => /x-frozen/.test(e)))
})
test("validateContractFrozen: пустой paths → ошибка", () => {
  const bad = "openapi: 3.1.0\ninfo:\n  x-frozen: true\npaths:\nresponses: {}\ncomponents:\n  schemas: {}\n"
  assert.ok(validateContractFrozen(bad).some((e) => /paths/.test(e)))
})
test("validateContractFrozen: AsyncAPI вариант", () => {
  const asyncOk = "asyncapi: 2.6.0\nx-frozen: true\nchannels:\n  evt: {}\ncomponents:\n  messages: {}\n"
  assert.deepEqual(validateContractFrozen(asyncOk), [])
})

// --- validateTicketHeaders (чисто, без fs) ---
const T = (over = {}) => ({ name: over.name ?? "05-mod.md", data: over.data === null ? null : { id: "05", type: "module", slice: "s1", blocked_by: ["01"], inputs: ["x"], outputs: ["internal/s1/logic.go"], io: "none", skills: [], ...over.data } })
const SCAFFOLD = { name: "01-scaffold.md", data: { id: "01", type: "scaffold", slice: "s1", blocked_by: [], inputs: [], outputs: ["cmd/app/main.go"], skills: ["service-scaffold"] } }

test("validateTicketHeaders: scaffold + module → нет ошибок", () => {
  assert.deepEqual(validateTicketHeaders([SCAFFOLD, T()]), [])
})
test("validateTicketHeaders: нет заголовка → ошибка", () => {
  assert.ok(validateTicketHeaders([SCAFFOLD, T({ name: "x.md", data: null })]).some((e) => /нет YAML-заголовка/.test(e)))
})
test("validateTicketHeaders: битый type → ошибка", () => {
  assert.ok(validateTicketHeaders([SCAFFOLD, T({ data: { type: "bogus" } })]).some((e) => /type=/.test(e)))
})
test("validateTicketHeaders: module без io → ошибка", () => {
  assert.ok(validateTicketHeaders([SCAFFOLD, T({ data: { io: undefined } })]).some((e) => /без валидного io/.test(e)))
})
test("validateTicketHeaders: тикет без outputs → ошибка", () => {
  assert.ok(validateTicketHeaders([SCAFFOLD, T({ data: { outputs: undefined } })]).some((e) => /outputs должен быть flow/.test(e)))
})
test("validateTicketHeaders: пустой outputs → ошибка (poka-yoke нечего проверять)", () => {
  assert.ok(validateTicketHeaders([SCAFFOLD, T({ data: { outputs: [] } })]).some((e) => /outputs пуст/.test(e)))
})
test("validateTicketHeaders: blocked_by в никуда → ошибка", () => {
  assert.ok(validateTicketHeaders([SCAFFOLD, T({ data: { blocked_by: ["99"] } })]).some((e) => /несуществующий тикет/.test(e)))
})
test("validateTicketHeaders: два scaffold → ошибка", () => {
  assert.ok(validateTicketHeaders([SCAFFOLD, { ...SCAFFOLD, name: "02-scaffold.md" }]).some((e) => /ровно ОДИН scaffold/.test(e)))
})
test("validateTicketHeaders: normId 05 == 5 (blocked_by резолвится)", () => {
  const child = T({ data: { blocked_by: ["1"] } })
  const s = { name: "01.md", data: { id: "01", type: "scaffold", slice: "s", blocked_by: [], inputs: [], outputs: ["cmd/app/main.go"], skills: ["service-scaffold"] } }
  assert.deepEqual(validateTicketHeaders([s, child]), [])
})

// --- io-роутер: skills тикета = ровно нужный набор (имплементер не берёт лишнего) ---
test("expectedTicketSkills: карта io-роутера", () => {
  assert.deepEqual(expectedTicketSkills("scaffold"), ["service-scaffold"])
  assert.deepEqual(expectedTicketSkills("component"), ["component-tests"])
  assert.deepEqual(expectedTicketSkills("module", "none"), [])
  assert.deepEqual(expectedTicketSkills("module", "http"), ["http-io"])
  assert.deepEqual(expectedTicketSkills("module", "llm"), ["http-io", "llm-client"])
  assert.deepEqual(expectedTicketSkills("module", "queue"), ["queue-io"])
  assert.deepEqual(expectedTicketSkills("module", "db"), ["db-io", "db-schema"])
  assert.equal(expectedTicketSkills("module", "bogus"), null)
})
test("validateTicketHeaders: module io:db с верными skills → нет ошибок", () => {
  assert.deepEqual(validateTicketHeaders([SCAFFOLD, T({ data: { io: "db", skills: ["db-io", "db-schema"] } })]), [])
})
test("validateTicketHeaders: skills порядок не важен (множество)", () => {
  assert.deepEqual(validateTicketHeaders([SCAFFOLD, T({ data: { io: "db", skills: ["db-schema", "db-io"] } })]), [])
})
test("validateTicketHeaders: недостающий скилл (io:db без db-schema) → ошибка", () => {
  assert.ok(validateTicketHeaders([SCAFFOLD, T({ data: { io: "db", skills: ["db-io"] } })]).some((e) => /io-роутер/.test(e)))
})
test("validateTicketHeaders: лишний скилл → ошибка", () => {
  assert.ok(validateTicketHeaders([SCAFFOLD, T({ data: { io: "http", skills: ["http-io", "db-io"] } })]).some((e) => /io-роутер/.test(e)))
})
test("validateTicketHeaders: io:none с непустыми skills → ошибка", () => {
  assert.ok(validateTicketHeaders([SCAFFOLD, T({ data: { io: "none", skills: ["http-io"] } })]).some((e) => /io-роутер/.test(e)))
})
test("validateTicketHeaders: component без component-tests → ошибка", () => {
  const comp = { name: "03-comp.md", data: { id: "03", type: "component", slice: "s1", blocked_by: ["01"], inputs: ["x"], skills: [] } }
  assert.ok(validateTicketHeaders([SCAFFOLD, comp]).some((e) => /io-роутер/.test(e)))
})
test("validateTicketHeaders: scaffold с чужим skills → ошибка", () => {
  assert.ok(validateTicketHeaders([{ ...SCAFFOLD, data: { ...SCAFFOLD.data, skills: ["component-tests"] } }]).some((e) => /io-роутер/.test(e)))
})
test("validateTicketHeaders: skills не список → ошибка", () => {
  assert.ok(validateTicketHeaders([SCAFFOLD, T({ data: { skills: undefined } })]).some((e) => /skills должен быть/.test(e)))
})

// --- harden-decomposition: validateFrdUseCases / validateSlices ---
import { validateFrdUseCases, validateSlices, countOpenapiOperations } from "../lib/validators.mjs"

test("validateFrdUseCases: чистый FRD (list + store-failure) → нет псевдо-UC", () => {
  const frd = "### UC1 — List services\n### UC2 — Data store missing/empty/malformed\n"
  assert.deepEqual(validateFrdUseCases(frd), [])
})
test("validateFrdUseCases: framework/boot UC → флаг", () => {
  const frd = "### UC1 — List services\n### UC4 — Method not allowed / unknown route\n### UC6 — Service startup with invalid config\n"
  const e = validateFrdUseCases(frd)
  assert.equal(e.length, 2)
  assert.ok(e.some((x) => /Method not allowed/.test(x)))
})
test("countOpenapiOperations: считает метод-ключи под paths", () => {
  assert.equal(countOpenapiOperations("paths:\n  /a:\n    get:\n    post:\n"), 2)
})
test("validateSlices: 1 срез / 1 op → OK", () => {
  const s = "## Slice inventory\n## Slice 01: list-services\n"
  assert.deepEqual(validateSlices(s, "paths:\n  /services:\n    get:\n"), [])
})
test("validateSlices: псевдо-срезы (scaffold/method/route/config) → флаг", () => {
  const s = "## Slice 01: service-scaffold\n## Slice 02: config-fail-fast\n## Slice 03: list-services\n## Slice 04: method-not-allowed\n## Slice 05: unknown-route\n"
  const e = validateSlices(s, "paths:\n  /services:\n    get:\n")
  assert.ok(e.some((x) => /service-scaffold/.test(x)))
  assert.ok(e.some((x) => /method-not-allowed/.test(x)))
  assert.ok(e.length >= 4)
})

// --- validateMermaid (C4/Mermaid syntax) ---
import { validateMermaid } from "../lib/validators.mjs"

test("validateMermaid: валидный C4 → нет ошибок", () => {
  const md = "```mermaid\nC4Component\n    title X\n    Container_Boundary(a, \"svc\") {\n      Component(h, \"H\", \"head\", \"orch\")\n    }\n    System_Ext(e, \"store\", \"\")\n    Rel(h, e, \"reads\")\n```\n"
  assert.deepEqual(validateMermaid(md), [])
})
test("validateMermaid: UML-стереотипы <<>> → ошибка", () => {
  const md = "```mermaid\n<<component>>\nhttpapi (ingress)\n```\n"
  const e = validateMermaid(md)
  assert.ok(e.length >= 1)
  assert.ok(e.some((x) => /UML-стереотип|тип диаграммы/.test(x)))
})
test("validateMermaid: не-C4 блок (flowchart) не трогаем глубоко", () => {
  const md = "```mermaid\nflowchart TD\n  A[Start] --> B[End]\n```\n"
  assert.deepEqual(validateMermaid(md), [])
})

// --- validatePlan: граф blocked_by (DAG) + порядок + DoD-замыкание + parseDodNumbers ---
import { validatePlan, parseDodNumbers } from "../lib/validators.mjs"

// Минимальный валидный план: scaffold(0) → component(1) → module(2, sink с DoD-1..2)
const P = () => [
  { name: "t0.md", data: { id: "00", type: "scaffold", blocked_by: [] }, body: "" },
  { name: "t1.md", data: { id: "01", type: "component", blocked_by: ["00"] }, body: "" },
  { name: "t2.md", data: { id: "02", type: "module", io: "none", blocked_by: ["00", "01"] }, body: "DoD-1 ok\nDoD-2 ok" },
]

test("validatePlan: валидный план + DoD покрыт → нет ошибок", () => {
  assert.deepEqual(validatePlan(P(), [1, 2]), [])
})
test("validatePlan: цикл в blocked_by → blocker", () => {
  const p = P(); p[0].data.blocked_by = ["02"] // 0→2→...→0
  assert.ok(validatePlan(p, []).some((e) => /цикл/.test(e)))
})
test("validatePlan: scaffold не корень → blocker", () => {
  // scaffold висит на независимом листе 09 (не цикл — 09 никого не блокирует)
  const p = P(); p[0].data.blocked_by = ["09"]
  p.push({ name: "t9.md", data: { id: "09", type: "module", io: "none", blocked_by: [] }, body: "" })
  assert.ok(validatePlan(p, []).some((e) => /scaffold должен быть корнем/.test(e)))
})
test("validatePlan: module без component-предка (RED-first нарушен) → blocker", () => {
  const p = P(); p[2].data.blocked_by = ["00"] // висит только на scaffold, минуя component
  assert.ok(validatePlan(p, []).some((e) => /RED-first/.test(e)))
})
test("validatePlan: sink не замыкает DoD → blocker", () => {
  const p = P(); p[2].body = "" // финальный тикет без DoD-N
  assert.ok(validatePlan(p, [1, 2]).some((e) => /не замыкает DoD/.test(e)))
})
test("validatePlan: DoD-замыкание неполно (пункт без владельца) → blocker", () => {
  assert.ok(validatePlan(P(), [1, 2, 3]).some((e) => /DoD-3/.test(e)))
})
test("validatePlan: dodNumbers=[] → DoD-проверка пропущена", () => {
  const p = P(); p[2].body = ""
  assert.deepEqual(validatePlan(p, []), [])
})

test("parseDodNumbers: нумерованный список под §Definition of done", () => {
  const task = "# T\n## Definition of done\nintro\n1. one\n2. two\n7. seven\n## Next\n9. nope\n"
  assert.deepEqual(parseDodNumbers(task), [1, 2, 7])
})
test("parseDodNumbers: нет секции → []", () => {
  assert.deepEqual(parseDodNumbers("# T\n## Scope\n1. x\n"), [])
})

// --- validateLayout (slice-aligned-code-layout, чисто) ---
const LAYOUT_OK = [
  "internal/list-services/head.go",
  "internal/list-services/io.go",
  "internal/list-services/logic.go",
  "internal/shared/money.go",
  "cmd/app/main.go",           // не под internal/ — игнор
]
test("validateLayout: slice-aligned + shared → нет ошибок", () => {
  assert.deepEqual(validateLayout(LAYOUT_OK, ["list-services"]), [])
})
test("validateLayout: layer-keyed internal/io → blocker (даже со slugs)", () => {
  const errs = validateLayout(["internal/io/store.go"], ["list-services"])
  assert.equal(errs.length, 1)
  assert.ok(/layer-keyed/.test(errs[0]) && /internal\/io\//.test(errs[0]))
})
test("validateLayout: layer-keyed ловится и БЕЗ объявленных срезов", () => {
  assert.ok(validateLayout(["internal/httpapi/handler.go"], []).some((e) => /layer-keyed/.test(e)))
})
test("validateLayout: корень не среза и не shared (slugs есть) → blocker", () => {
  assert.ok(validateLayout(["internal/orders/head.go"], ["list-services"]).some((e) => /не объявлен ни одним срезом/.test(e)))
})
test("validateLayout: неизвестный корень без slugs → НЕ блокируем (консервативно)", () => {
  assert.deepEqual(validateLayout(["internal/orders/head.go"], []), [])
})
test("validateLayout: одна ошибка на корень, не на каждый путь", () => {
  const errs = validateLayout(["internal/io/a.go", "internal/io/b.go", "internal/io/c.go"], ["s1"])
  assert.equal(errs.length, 1)
})
test("validateLayout: slug с docs-префиксом slice- нормализуется", () => {
  assert.deepEqual(validateLayout(["internal/list-services/head.go"], ["slice-list-services"]), [])
})
test("validateLayout: internal/shared/ разрешён всегда", () => {
  assert.deepEqual(validateLayout(["internal/shared/customerid.go"], []), [])
})
test("validateLayout: markdown-токены с кавычками/backtick чистятся", () => {
  assert.deepEqual(validateLayout(["`internal/list-services/io.go`", "./internal/list-services/head.go"], ["list-services"]), [])
})

// --- validateSliceDeclarations (рунг 1: граница объявлена до дизайна) ---
const SLICES_OK = `# slices
## Slice inventory
что-то про инвентарь без Owns package
## Slice 01: list services by platform
Status: \`todo\`
External input: GET /services
Owns package: \`internal/list-services/\`
Use case(s): UC1
## Slice 02: create order
Owns package: internal/create-order/
`
test("validateSliceDeclarations: все срезы объявили Owns package → нет ошибок", () => {
  assert.deepEqual(validateSliceDeclarations(SLICES_OK), [])
})
test("validateSliceDeclarations: срез без Owns package → ошибка", () => {
  const bad = SLICES_OK.replace("Owns package: `internal/list-services/`\n", "")
  assert.ok(validateSliceDeclarations(bad).some((e) => /Slice 01.*нет поля Owns package/.test(e)))
})
test("validateSliceDeclarations: layer-keyed корень в объявлении → ошибка", () => {
  const bad = SLICES_OK.replace("internal/create-order/", "internal/httpapi/")
  assert.ok(validateSliceDeclarations(bad).some((e) => /Slice 02.*layer-keyed/.test(e)))
})
test("validateSliceDeclarations: кривая форма (не internal/<slug>/) → ошибка", () => {
  const bad = SLICES_OK.replace("internal/create-order/", "pkg/orders")
  assert.ok(validateSliceDeclarations(bad).some((e) => /не вида internal/.test(e)))
})
test("validateSliceDeclarations: '## Slice inventory' не считается срезом", () => {
  // единственная секция среза (01) валидна, inventory без Owns package не даёт ошибки
  const one = "## Slice inventory\nтекст\n## Slice 01: x\nOwns package: `internal/x/`\n"
  assert.deepEqual(validateSliceDeclarations(one), [])
})

// --- validateContextMap (Ф4: карта контекстов + ADR-нумерация) ---
const CTX2 = ["docs/design/slice-ordering/CONTEXT.md", "docs/design/slice-billing/CONTEXT.md"]
const MAP_OK = `# Context Map
## Contexts
- [Ordering](./docs/design/slice-ordering/CONTEXT.md) — orders
- [Billing](./docs/design/slice-billing/CONTEXT.md) — invoices
## Relationships
- Ordering → Billing: OrderPlaced
`
test("validateContextMap: single-context (1 CONTEXT.md, нет карты) → нет ошибок", () => {
  assert.deepEqual(validateContextMap(["CONTEXT.md"], "", []), [])
})
test("validateContextMap: multi + полная карта + ADR 1,2 → нет ошибок", () => {
  assert.deepEqual(validateContextMap(CTX2, MAP_OK, [{ dir: "docs/adr", numbers: [1, 2] }]), [])
})
test("validateContextMap: ≥2 CONTEXT.md без карты → blocker", () => {
  assert.ok(validateContextMap(CTX2, "", []).some((e) => /нет root CONTEXT-MAP/.test(e)))
})
test("validateContextMap: карта без Relationships → blocker", () => {
  const noRel = MAP_OK.replace(/## Relationships[\s\S]*/, "")
  assert.ok(validateContextMap(CTX2, noRel, []).some((e) => /Relationships/.test(e)))
})
test("validateContextMap: ссылка карты не резолвится → blocker", () => {
  const bad = MAP_OK.replace("slice-billing/CONTEXT.md", "slice-payments/CONTEXT.md")
  assert.ok(validateContextMap(CTX2, bad, []).some((e) => /не резолвится.*payments/.test(e)))
})
test("validateContextMap: контекст не покрыт картой → blocker (S3)", () => {
  // billing существует, но карта ссылается только на ordering
  const partial = MAP_OK.replace(/- \[Billing\][^\n]*\n/, "")
  assert.ok(validateContextMap(CTX2, partial, []).some((e) => /billing.*не указан/.test(e)))
})
test("validateContextMap: дыра в ADR-нумерации → blocker", () => {
  assert.ok(validateContextMap(["CONTEXT.md"], "", [{ dir: "docs/adr", numbers: [1, 3] }]).some((e) => /дыр/.test(e)))
})
test("validateContextMap: дубль ADR-номера → blocker", () => {
  assert.ok(validateContextMap(["CONTEXT.md"], "", [{ dir: "docs/adr", numbers: [1, 1, 2] }]).some((e) => /дубль/.test(e)))
})

// --- validateComponentTests (защита оракула) ---
const FEAT_OK = { business: ["1. Happy", "2. Empty store", "3. Not found", "4. Malformed"], wip: 4, smoke: 1 }
test("validateComponentTests: полное покрытие + все @wip + smoke + N совпал → нет ошибок", () => {
  assert.deepEqual(validateComponentTests(FEAT_OK, 4), [])
})
test("validateComponentTests: declaredN=null → сверка с дизайном мягко пропущена", () => {
  assert.deepEqual(validateComponentTests(FEAT_OK, null), [])
})
test("validateComponentTests: #сценариев ≠ дизайн N → blocker (пропуск/выдумка)", () => {
  assert.ok(validateComponentTests(FEAT_OK, 5).some((e) => /≠ дизайн N=5/.test(e)))
})
test("validateComponentTests: не все @wip → blocker (гейминг)", () => {
  assert.ok(validateComponentTests({ ...FEAT_OK, wip: 3 }, 4).some((e) => /@wip/.test(e)))
})
test("validateComponentTests: нет smoke → blocker (обвязка не доказана)", () => {
  assert.ok(validateComponentTests({ ...FEAT_OK, smoke: 0 }, 4).some((e) => /smoke/.test(e)))
})
test("validateComponentTests: дыра в нумерации сценариев → blocker (пропущен)", () => {
  const gap = { business: ["1. a", "2. b", "4. d"], wip: 3, smoke: 1 }
  assert.ok(validateComponentTests(gap, null).some((e) => /нумераци/.test(e)))
})
test("validateComponentTests: дубль сценария → blocker", () => {
  const dup = { business: ["1. a", "1. a"], wip: 2, smoke: 1 }
  assert.ok(validateComponentTests(dup, null).some((e) => /дубль/.test(e)))
})
test("validateComponentTests: пустой (только smoke) → blocker", () => {
  assert.ok(validateComponentTests({ business: [], wip: 0, smoke: 1 }, null).some((e) => /покрытие не реализовано/.test(e)))
})
