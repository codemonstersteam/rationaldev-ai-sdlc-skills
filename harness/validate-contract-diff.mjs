// Diff-gate эволюции контракта на полосах minor|major: новый x-frozen контракт vs его ПРОШЛАЯ версия
// (git HEAD). Флагует breaking-классы (removed / type-changed / new-required / removed-op).
// Два режима:
//   без флага (major, обзор на Gate #1) — ADVISORY: печатаем список, exit 0; осознанный break принимает оператор;
//   --require-additive (minor)          — аддитивность ОБЯЗАНА держаться: любой breaking-класс ⇒ STOP, exit 2
//                                         (вес определён неверно → ре-триаж как major).
// Неоценимый случай (нет машиночитаемого контракта / нет базы в HEAD / YAML без парсера) НЕ блокирует даже
// с флагом: аддитивность механически не доказуема → exit 0, доказывает её @fagan (существующие тесты не
// тронуты + весь сьют зелёный).
// Логика — чистая contractDiff (экспортируется для теста). Intra-repo (спека сервиса vs её прошлая версия);
// межсервисный «кого сломает» — это pinout reverse/netlist, вне этого гейта.
// Разбор: JSON-контракты (config/report.schema.json, JSON-OpenAPI) — dependency-free. YAML → нужен парсер
// (oasdiff/js-yaml) — тогда печатаем предупреждение и пропускаем структурный дифф.
// Запуск: node harness/validate-contract-diff.mjs [contractPath] [--require-additive]
// exit 0 = совместимо / не оценимо / advisory; exit 2 = breaking при --require-additive.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { execSync } from "node:child_process"
import { join, relative, resolve } from "node:path"

// --- contractDiff :: (prevObj, nextObj, path) -> [{code, path, detail?}] --------------------
// Breaking-классы между двумя JSON-Schema/OpenAPI-контрактами (разобранными в JS). Рекурсивно по properties.
export function contractDiff(prev, next, path = "") {
  const breaking = []
  if (!prev || !next || typeof prev !== "object" || typeof next !== "object") return breaking
  // тип на узле сменился
  if (prev.type && next.type && prev.type !== next.type)
    breaking.push({ code: "TYPE_CHANGED", path: path || "(root)", detail: `${prev.type} → ${next.type}` })
  // новое обязательное поле
  const prevReq = new Set(Array.isArray(prev.required) ? prev.required : [])
  for (const r of (Array.isArray(next.required) ? next.required : []))
    if (!prevReq.has(r)) breaking.push({ code: "NEW_REQUIRED", path: `${path}/${r}` })
  // свойства: убранные + рекурсия по общим
  const pp = prev.properties || {}, np = next.properties || {}
  for (const k of Object.keys(pp)) {
    if (!(k in np)) breaking.push({ code: "REMOVED", path: `${path}/${k}` })
    else breaking.push(...contractDiff(pp[k], np[k], `${path}/${k}`))
  }
  // OpenAPI/AsyncAPI: убранная операция/канал
  const po = prev.paths || prev.channels, no = next.paths || next.channels
  if (po && no) for (const op of Object.keys(po)) if (!(op in no)) breaking.push({ code: "REMOVED_OP", path: op })
  return breaking
}

// --- verdict :: (breaking, {requireAdditive}) -> {code, lines} ---------------------------------
// Чистое решение «что печатаем и с каким кодом выходим» по списку breaking-классов. Единственное место,
// где режим превращается в exit-код: [] → 0 (совместимо) · breaking+флаг → 2 (STOP) · breaking без флага → 0.
export function verdict(breaking, { requireAdditive = false, rel = "контракт" } = {}) {
  if (!breaking.length) return { code: 0, lines: [`нет breaking-изменений в ${rel} (аддитивно, совместимо)`] }
  const head = requireAdditive
    ? `STOP: аддитивность нарушена — BREAKING в ${rel} (${breaking.length}). minor обязан быть строго аддитивным: ` +
      `вес определён неверно → ре-триаж как major (@wirth-triage), спека и тикеты переделываются под major.`
    : `⚠️ BREAKING в ${rel} (${breaking.length}) — осознанный major на Gate #1 (advisory, не блокирую):`
  const lines = [head, ...breaking.map((b) => `  • ${b.code} @ ${b.path}${b.detail ? " (" + b.detail + ")" : ""}`)]
  return { code: requireAdditive ? 2 : 0, lines }
}

// --- CLI (I/O) --------------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2)
  const requireAdditive = argv.includes("--require-additive")
  // Позиционный аргумент: КАТАЛОГ = корень репо (соглашение остальных валидаторов: `validate-x.mjs .`),
  // ФАЙЛ = явный контракт. Раньше `.` молча трактовался как контракт и гейт всегда выдавал «неоценимо» —
  // тихий проход там, где ждали проверку. Форма вызова не должна отключать гейт.
  const pos = argv.filter((a) => !a.startsWith("--"))
  const dirArg = pos.find((a) => existsSync(a) && statSync(a).isDirectory())
  const root = dirArg ? resolve(dirArg) : process.cwd()
  const explicit = pos.find((a) => a !== dirArg)

  // ВСЕ машиночитаемые контракты, а не первый попавшийся: сервис держит и config.schema.json, и
  // report.schema.json — слом в одном не должен маскироваться совместимостью другого.
  const findContracts = () => {
    if (explicit) return [resolve(root, explicit)]
    const dir = join(root, "api-specification")
    if (!existsSync(dir)) return []
    return readdirSync(dir).filter((f) => /\.(json|ya?ml)$/i.test(f)).sort().map((f) => join(dir, f))
  }
  const contracts = findContracts()

  // Неоценимый случай: механически аддитивность не доказуема → НЕ блокируем даже с --require-additive;
  // её доказывает @fagan (существующие тесты не тронуты + весь сьют зелёный).
  const note = (msg) => process.stdout.write(`[contract-diff] ${msg}\n`)
  const unevaluableExit = () => {
    if (requireAdditive) note("аддитивность механически не доказуема — гейт не блокирует; доказывает @fagan: существующие тесты не тронуты + весь сьют зелёный")
    process.exit(0)
  }

  if (!contracts.length) { note("машиночитаемый контракт не найден — пропуск"); unevaluableExit() }

  let evaluated = 0, worst = 0
  for (const contract of contracts) {
    const rel = relative(root, contract)
    if (!existsSync(contract)) { note(`контракт ${rel} не найден — пропуск`); continue }
    if (!/\.json$/i.test(contract)) { note(`YAML-контракт (${rel}) — структурный дифф нужен парсер (oasdiff/js-yaml); пропуск. Установите oasdiff для полного diff.`); continue }

    let prevRaw
    try { prevRaw = execSync(`git show HEAD:${JSON.stringify(rel)}`, { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }) }
    catch { note(`прошлой версии ${rel} в git HEAD нет (новый контракт?) — нет базы для diff`); continue }

    let prev, next
    try { prev = JSON.parse(prevRaw); next = JSON.parse(readFileSync(contract, "utf8")) }
    catch (e) { note(`не разобрать контракт ${rel} как JSON: ${e.message}`); continue }

    evaluated++
    const { code, lines } = verdict(contractDiff(prev, next), { requireAdditive, rel })
    for (const l of lines) note(l)
    worst = Math.max(worst, code)
  }

  if (!evaluated) unevaluableExit()
  process.exit(worst) // 0 = совместимо/advisory · 2 = breaking при --require-additive (STOP → ре-триаж как major)
}
