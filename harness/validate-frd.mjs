// Antecedent-валидатор FRD — «конструктор» на входе планирования: потребитель (wirth-slicer)
// принимает FRD, только если он структурно ПОЛОН по handoff-чеклисту `requirements-intake`.
// Не presence-only: проверяет наличие design-критичных секций, а не просто «файл есть».
//
// Запуск: node harness/validate-frd.mjs [frdPath]
//   по умолчанию frdPath = .agent/planner/frd.md (относительно cwd).
// exit 0 = FRD годен к дизайну; exit 1 = чего не хватает (на stderr).
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const frd = process.argv[2] || join(process.cwd(), ".agent", "planner", "frd.md")
if (!existsSync(frd)) { console.error(`validate-frd: нет файла FRD ${frd}`); process.exit(1) }
const text = readFileSync(frd, "utf8").replace(/\r\n/g, "\n")
const headings = text.split("\n").filter((l) => /^#{1,6}\s/.test(l)).map((l) => l.toLowerCase())
const has = (re) => headings.some((h) => re.test(h)) || re.test(text.toLowerCase())

// Design-критичные секции (по handoff-чеклисту requirements-intake). RU/EN варианты.
const REQUIRED = [
  ["problem statement / постановка", /problem statement|постановка задачи|проблем/],
  ["actors & external systems / акторы", /actors?|акторы|внешние систем/],
  ["use cases (Cockburn) / use-cases", /use[ -]?cases?|сценари(и|й)|use[ -]?case/],
  ["contract (draft) / контракт", /contract|контракт|openapi|asyncapi|api/],
  ["failure-mode map / карта отказов", /failure[- ]?mode|карта .*отказ|режим.*отказ|error|ошибк/],
]
const errors = []
for (const [label, re] of REQUIRED) if (!has(re)) errors.push(`нет секции: ${label}`)

// Хотя бы один use-case с расширениями (Extensions = будущие failure-сценарии).
if (!/extensions?|расширени|альтернатив|\bNNa\b|\b\d+a\b/i.test(text)) {
  errors.push("нет Extensions в use-cases (нет ветвей отказа → нечего покрывать компонентными)")
}

if (errors.length) {
  console.error(`validate-frd: FRD НЕ полон (${frd}):`)
  for (const e of errors) console.error(`  ✗ ${e}`)
  process.exit(1)
}
console.log(`validate-frd: OK — FRD структурно полон (акторы, use-cases с Extensions, контракт-черновик, карта отказов)`)
