// Advisory diff-gate для rework-api: новый x-frozen контракт vs его ПРОШЛАЯ версия (git HEAD).
// Флагует breaking-классы (removed / type-changed / new-required / removed-op) для @mills/Gate #1 —
// это ADVISORY (exit 0 всегда): осознанный major принимает оператор, гейт не блокирует.
// Логика — чистая contractDiff (экспортируется для теста). Intra-repo (спека сервиса vs её прошлая версия);
// межсервисный «кого сломает» — это pinout reverse/netlist, вне этого гейта.
// Разбор: JSON-контракты (config/report.schema.json, JSON-OpenAPI) — dependency-free. YAML → нужен парсер
// (oasdiff/js-yaml) — тогда печатаем предупреждение и пропускаем структурный дифф (advisory не падает).
// Запуск: node harness/validate-contract-diff.mjs [contractPath]

import { readFileSync, existsSync, readdirSync } from "node:fs"
import { execSync } from "node:child_process"
import { join, relative } from "node:path"

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

// --- CLI (I/O) --------------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd()
  const explicit = process.argv[2]
  // найти JSON-контракт под api-specification/ (или явный путь)
  const findContract = () => {
    if (explicit) return explicit
    const dir = join(root, "api-specification")
    if (!existsSync(dir)) return null
    const j = readdirSync(dir).find((f) => /\.(json)$/i.test(f) && /openapi|contract|config\.schema|asyncapi/i.test(f))
    return j ? join(dir, j) : null
  }
  const contract = findContract()
  const advisory = (msg) => { process.stdout.write("[contract-diff] " + msg + "\n"); process.exit(0) }

  if (!contract || !existsSync(contract)) advisory("контракт не найден — пропуск (advisory)")
  const rel = relative(root, contract)
  if (!/\.json$/i.test(contract)) advisory(`YAML-контракт (${rel}) — структурный дифф нужен парсер (oasdiff/js-yaml); пропуск. Установите oasdiff для полного diff.`)

  let prevRaw
  try { prevRaw = execSync(`git show HEAD:${JSON.stringify(rel)}`, { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }) }
  catch { advisory(`прошлой версии ${rel} в git HEAD нет (новый контракт?) — нет базы для diff (advisory)`) }

  let prev, next
  try { prev = JSON.parse(prevRaw); next = JSON.parse(readFileSync(contract, "utf8")) }
  catch (e) { advisory(`не разобрать контракт как JSON: ${e.message} (advisory)`) }

  const breaking = contractDiff(prev, next)
  if (!breaking.length) advisory(`нет breaking-изменений в ${rel} (совместимо)`)
  process.stdout.write(`[contract-diff] ⚠️ BREAKING в ${rel} (${breaking.length}) — осознанный major на Gate #1:\n`)
  for (const b of breaking) process.stdout.write(`  • ${b.code} @ ${b.path}${b.detail ? " (" + b.detail + ")" : ""}\n`)
  process.exit(0) // advisory: НЕ блокируем — решает оператор
}
