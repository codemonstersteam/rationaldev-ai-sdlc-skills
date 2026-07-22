// CLI-оболочка (I/O) валидатора компонентных тестов — защита ОРАКУЛА (предпосылка к удешевлению
// wirth-tester до Qwen). Логика — lib/validators.mjs (validateComponentTests, чисто).
// Сверяет РЕАЛИЗАЦИЮ (.feature) с ДИЗАЙНОМ (contracts.md § Component scenarios):
//   • #бизнес-сценариев == N (формула 1+Σ), если N извлекается (иначе soft-skip);
//   • все бизнес-сценарии @wip (снятие = акт фиксера); smoke есть; без дублей; нумерация 1..n.
// RED-по-бизнес-причине и резолв step-def остаются @linger/@mills (не механизируемо тут).
//
// Запуск: node harness/validate-component-tests.mjs [projectRoot]
// exit 0 = ок; exit 1 = покрытие неполно (недо/пере-покрытие, не-@wip, нет smoke) (stderr).
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs"
import { join } from "node:path"
import { validateComponentTests } from "./lib/validators.mjs"

const root = process.argv[2] || process.cwd()
const SMOKE = /smoke|health/i
const SCENARIO = /^\s*(?:Сценарий|Scenario|Scenario Outline|Структура сценария)\s*:\s*(.+?)\s*$/i

// собрать все .feature рекурсивно
const features = []
const walk = (dir) => {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p)
    else if (e.endsWith(".feature")) features.push(p)
  }
}
walk(join(root, "component-tests"))

// разобрать: бизнес-сценарии, @wip (ТОЛЬКО тег-строки, с наследованием feature-level), smoke.
// Gherkin: тег над Функционал/Feature → на все сценарии файла; тег над Сценарий → на него.
const TAG = /^\s*@/
const isWipTag = (l) => TAG.test(l) && /@wip\b/i.test(l)
const FEATURE = /^\s*(?:Функционал|Feature)\s*:/i
const business = []
let wip = 0, smoke = 0
for (const f of features) {
  const isSmokeFile = SMOKE.test(f)
  let featureWip = false, pending = false
  for (const line of readFileSync(f, "utf8").split("\n")) {
    if (isWipTag(line)) { pending = true; continue }
    if (FEATURE.test(line)) { featureWip = pending; pending = false; continue }
    const m = line.match(SCENARIO)
    if (!m) { if (line.trim()) pending = false; continue } // не-тег, не-сценарий → сбрасываем pending
    if (isSmokeFile || SMOKE.test(m[1])) { smoke++ }
    else { business.push(m[1]); if (featureWip || pending) wip++ }
    pending = false
  }
}

// N из дизайна: сумма по contracts.md всех срезов, если ЯВНО объявлено (**N = 4** / `N=4` / `N = 1 + 3`).
// Не извлекается → null (сверка с дизайном мягко пропускается — без ложного blocker).
const design = join(root, "docs", "design")
let declaredN = 0, gotN = false
if (existsSync(design))
  for (const s of readdirSync(design).filter((d) => d.startsWith("slice-"))) {
    const c = join(design, s, "contracts.md")
    if (!existsSync(c)) continue
    const sec = readFileSync(c, "utf8").split(/^#{1,3}\s+Component scenarios/im)[1]
    if (!sec) continue
    const head = sec.split(/^#{1,3}\s/m)[0]
    // Только СТРОГАЯ форма N = <d> + <d> (оба числа). Прозу «N = 1 + Σ …» НЕ парсим (Σ не число → null → мягкий пропуск).
    const arith = head.match(/N\s*=\s*(\d+)\s*(?:\(happy\))?\s*\+\s*(\d+)\b/i)
    if (arith) { declaredN += Number(arith[1]) + Number(arith[2]); gotN = true }
  }

// Проект уже существует (SemVer-полосы patch|minor|major, маркер от wirth-triage): baseline-сценарии
// легитимно НЕ @wip (инвариант, зелёные) — @wip только у новой/изменённой поверхности.
const existingProject = (() => { try { return ["patch", "minor", "major"].includes(readFileSync(join(root, ".agent", "planner", "mode"), "utf8").trim()) } catch { return false } })()
const errors = validateComponentTests({ business, wip, smoke }, gotN ? declaredN : null, { existingProject })
if (errors.length) {
  console.error("validate-component-tests: ПОКРЫТИЕ неполно (кол-во / @wip / smoke):")
  for (const e of errors) console.error(`  ✗ ${e}`)
  console.error("  → реализуй РОВНО спроектированные сценарии (1+Σ), все @wip, smoke обязателен.")
  process.exit(1)
}
const nInfo = gotN ? `, дизайн N=${declaredN}` : ", дизайн-N не извлечён (сверка мягко пропущена)"
console.log(`validate-component-tests: OK — ${business.length} бизнес-сценариев @wip, smoke=${smoke}${nInfo}`)
