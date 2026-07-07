// CLI-оболочка (I/O) валидатора valid-by-construction. Логика — lib/validators.mjs
// (validateConstructors, чисто). Правило (program-design step-03): каждый доменный value-object в
// Go имеет НЕэкспортируемые поля + единственную фабрику NewX(raw) -> (X, error), которая проверяет
// КАЖДОЕ поле на диапазон; голый литерал X{...} вне NewX = blocker (Go-аналог приватного
// конструктора). wire-DTO (Raw*/…Request/…Response, поля с json:/yaml:-тегами) исключены.
//
// Источник Go: реальные internal/<slug>/*.go (без *_test.go). Валидатор implementation-time —
// у @hughes/@linger в DoD модульного тикета, НЕ на Gate #1 (там Go ещё нет → no-op).
// Область (гибрид): domainTypes из docs/design/slice-*/module-tree.md (узлы constructor/subtype,
// имя NewX → тип X); если module-tree нет — эвристика (фабрика есть ИЛИ не DTO по имени/тегам).
//
// Запуск: node harness/validate-constructors.mjs [projectRoot]
//   projectRoot — где internal/ и docs/design (по умолчанию cwd)
// exit 0 = valid by construction (или нечего проверять); exit 1 = нарушение (stderr).
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs"
import { join } from "node:path"
import { validateConstructors } from "./lib/validators.mjs"

const root = process.argv.slice(2).find((a) => !a.startsWith("--")) || process.cwd()
const internalDir = join(root, "internal")
const design = join(root, "docs", "design")

// 1) собрать *.go среза (без тестов) из internal/<slug>/…
const files = []
const walk = (dir) => {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return
  for (const e of readdirSync(dir)) {
    const abs = join(dir, e)
    if (statSync(abs).isDirectory()) walk(abs)
    else if (e.endsWith(".go") && !e.endsWith("_test.go"))
      files.push({ path: abs.replace(root + "/", ""), src: readFileSync(abs, "utf8") })
  }
}
walk(internalDir)

if (!files.length) {
  console.log("validate-constructors: нет internal/**/*.go для проверки (нечего валидировать — до реализации)")
  process.exit(0)
}

// 2) domainTypes из module-tree (узлы constructor/subtype: NewX → X). Нет module-tree → null (эвристика).
let domainTypes = null
if (existsSync(design)) {
  const types = new Set()
  for (const slice of readdirSync(design).filter((d) => d.startsWith("slice-"))) {
    const mt = join(design, slice, "module-tree.md")
    if (!existsSync(mt)) continue
    for (const line of readFileSync(mt, "utf8").split("\n")) {
      if (!/^\s*\|/.test(line) || !/constructor|subtype/i.test(line)) continue // только строки-таблицы узлов
      for (const m of line.matchAll(/`New(\w{2,})`/g)) types.add(m[1]) // backtick-узел, тип >1 символа (не плейсхолдер NewT)
    }
  }
  if (types.size) domainTypes = types
}

const errors = validateConstructors(files, domainTypes)
if (errors.length) {
  console.error("validate-constructors: НЕ valid by construction — доменный инвариант не гарантирован типом:")
  for (const e of errors) console.error(`  ✗ ${e}`)
  console.error("  → правило (step-03): НЕэкспортируемые поля + единственная фабрика NewX, проверяющая каждое поле; " +
    "голый X{...} вне NewX запрещён.")
  process.exit(1)
}
const scope = domainTypes ? `по module-tree: ${[...domainTypes].join(", ")}` : "по эвристике (module-tree нет)"
console.log(`validate-constructors: OK — доменные структуры валидны по построению (${scope}; go-файлов: ${files.length})`)
