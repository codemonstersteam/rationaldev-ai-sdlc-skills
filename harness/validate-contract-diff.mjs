// Diff-gate эволюции контракта: новый x-frozen контракт vs его ПРОШЛАЯ версия (git HEAD).
// ОДНО поведение (инструмент не знает про веса): нашёл слом совместимости → печатает список, exit 2;
// аддитивно → exit 0. Разница по весам живёт в КОНВЕЙЕРЕ, не здесь (minor: 2 = ре-триаж как major;
// patch: 2 = патч тронул контракт, не вправе → STOP; major: 2 ожидаем, список — артефакт BREAKING CHANGE).
//
// Диспетчер по формату спеки (не самописный дифф на все случаи):
//   OpenAPI (openapi:)   → внешний `oasdiff breaking`   (отраслевой классификатор ломающих)
//   AsyncAPI (asyncapi:)  → внешний `asyncapi diff`
//   JSON-Schema (.json)   → встроенный структурный дифф contractDiff (dependency-free)
// FAIL-CLOSED: формат распознан, но инструмента нет в PATH / сравнить не удалось → STOP exit 2 с
// точной командой установки (инверсия старого «неоценимо → 0»: на сервисе гейт больше не молчит).
// Внешний бинарь зовём ТОЛЬКО если он есть в PATH (иначе — осмысленный STOP, не падение процесса).
// Genuinely-неоценимо (нет базы в HEAD — новый контракт · формат не распознан) — НЕ блокирует (exit 0),
// это не «знаем как, но нет инструмента», а «нечего/непонятно диффить»; аддитивность доказывает @fagan.
//
// Логика — чистые contractDiff/verdict/detectFormat/dispatchContract (экспортируются для юнит-тестов).
// Запуск: node harness/validate-contract-diff.mjs [contractPath|repoRoot]
// exit 0 = совместимо / нет базы / формат не распознан; exit 2 = breaking ИЛИ fail-closed.

import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs"
import { execSync, execFileSync } from "node:child_process"
import { join, relative, resolve, extname } from "node:path"
import { tmpdir } from "node:os"

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

// --- Отраслевые дифферы: формат → бинарь + команда установки + форма вызова ---------------------
export const FORMAT_TOOL = {
  openapi:  { bin: "oasdiff",  install: "brew install oasdiff  (или: go install github.com/oasdiff/oasdiff@latest)", cmd: "oasdiff breaking <base> <revision>" },
  asyncapi: { bin: "asyncapi", install: "npm install -g @asyncapi/cli", cmd: "asyncapi diff <base> <revision>" },
}

// --- detectFormat :: (filename, content) -> "openapi"|"asyncapi"|"jsonschema"|"unknown" ----------
// Формат — по содержимому (маркер-поле), с откатом на расширение. Так `openapi.yaml` больше не
// «неоценимо»: поле `openapi:` виден текстуально и без YAML-парсера → маршрут в oasdiff.
export function detectFormat(filename, content) {
  const c = String(content || "")
  // YAML-маркер (line-start `asyncapi:`) ИЛИ JSON-ключ (`"asyncapi":` где угодно в объекте).
  if (/(^|\n)\s*asyncapi\s*:/.test(c) || /"asyncapi"\s*:/.test(c)) return "asyncapi"
  if (/(^|\n)\s*openapi\s*:/.test(c) || /"openapi"\s*:/.test(c)) return "openapi"
  if (/\.json$/i.test(String(filename))) return "jsonschema"
  return "unknown" // YAML без маркера openapi/asyncapi — не наш распознаваемый формат
}

// --- verdict :: (breaking, {rel}) -> {code, lines} ---------------------------------------------
// ЕДИНСТВЕННОЕ поведение: [] → 0 (аддитивно) · непустой breaking → 2. Инструмент не знает про веса —
// как read exit 2, решает конвейер.
function breakingHead(rel, n) {
  return `BREAKING в ${rel} (${n}) — совместимость документированного контракта нарушена, exit 2. ` +
    `Разрешение по весу в конвейере: minor → вес неверен, ре-триаж как major; patch → патч тронул контракт (STOP); ` +
    `major → слом ожидаем, список идёт в BREAKING CHANGE тела PR и во вход миграционного тикета.`
}
export function verdict(breaking, { rel = "контракт" } = {}) {
  if (!breaking.length) return { code: 0, lines: [`нет breaking-изменений в ${rel} (аддитивно, совместимо)`] }
  const lines = [breakingHead(rel, breaking.length),
    ...breaking.map((b) => `  • ${b.code} @ ${b.path}${b.detail ? " (" + b.detail + ")" : ""}`)]
  return { code: 2, lines }
}

// fail-closed вердикт: формат распознан, но оценить невозможно → STOP exit 2 + как это починить.
export function failClosed(rel, why, fix) {
  return { code: 2, failClosed: true, lines: [`STOP (fail-closed): ${rel} — ${why}. Аддитивность не доказана, гейт закрывается. → ${fix}`] }
}

// --- dispatchContract :: ({rel, format, prevText, nextText}, deps) -> {code, lines} --------------
// Чистое ядро диспетчера. deps.hasBinary(bin)->bool и deps.runExternal(format, prevText, nextText, rel)
// ->{breaking, lines} инъектируются (в тестах — моки наличия/отсутствия бинаря и вывода тула).
export function dispatchContract({ rel, format, prevText, nextText }, deps = {}) {
  const { hasBinary = () => false, runExternal } = deps

  if (format === "jsonschema") {
    let prev, next
    try { prev = JSON.parse(prevText); next = JSON.parse(nextText) }
    catch (e) { return failClosed(rel, `распознан как JSON-Schema, но не парсится (${e.message})`, "починить JSON контракта и повторить") }
    return verdict(contractDiff(prev, next), { rel })
  }

  const tool = FORMAT_TOOL[format]
  if (tool) {
    if (!hasBinary(tool.bin))
      return failClosed(rel, `формат ${format}, но инструмента '${tool.bin}' нет в PATH`, `установите: ${tool.install}`)
    let res
    try { res = runExternal(format, prevText, nextText, rel) }
    catch (e) { return failClosed(rel, `сравнить ${format} через '${tool.bin}' не удалось (${e.message})`, `проверьте '${tool.bin}' (${tool.cmd})`) }
    if (!res.breaking) return { code: 0, lines: [`нет breaking-изменений в ${rel} (${format} через ${tool.bin}) — аддитивно`] }
    const list = res.lines && res.lines.length ? res.lines : [`${tool.bin}: обнаружены ломающие изменения`]
    return { code: 2, lines: [breakingHead(rel, list.length), ...list.map((l) => "  • " + l)] }
  }

  // формат не распознан — не «знаем как, но нет тула», а нечего/непонятно диффить → не блокируем
  return { code: 0, skip: true, lines: [`формат ${rel} не распознан (не openapi/asyncapi/json-schema) — гейт не оценивает; аддитивность доказывает @fagan`] }
}

// --- PATH-детект бинаря (реальная зависимость deps.hasBinary) ------------------------------------
// Внешний тул зовём ТОЛЬКО если он реально есть в PATH — иначе fail-closed STOP, а не крэш execFileSync.
export function binaryInPath(bin) {
  const sep = process.platform === "win32" ? ";" : ":"
  const exts = process.platform === "win32" ? (process.env.PATHEXT || ".EXE;.CMD;.BAT").split(";") : [""]
  for (const dir of (process.env.PATH || "").split(sep)) {
    if (!dir) continue
    for (const ext of exts) {
      const p = join(dir, bin + ext)
      try { if (existsSync(p) && statSync(p).isFile()) return true } catch { /* ignore */ }
    }
  }
  return false
}

// --- CLI (I/O) --------------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2)
  // Позиционный аргумент: КАТАЛОГ = корень репо (`validate-x.mjs .`), ФАЙЛ = явный контракт.
  // Флаги (`--*`) игнорируются: инструмент однорежимный, `--require-additive` больше не существует.
  const pos = argv.filter((a) => !a.startsWith("--"))
  const dirArg = pos.find((a) => existsSync(a) && statSync(a).isDirectory())
  const root = dirArg ? resolve(dirArg) : process.cwd()
  const explicit = pos.find((a) => a !== dirArg)
  const note = (msg) => process.stdout.write(`[contract-diff] ${msg}\n`)

  // ВСЕ машиночитаемые контракты (сервис держит config.schema.json + report.schema.json — слом в одном
  // не маскируется совместимостью другого).
  const findContracts = () => {
    if (explicit) return [resolve(root, explicit)]
    const dir = join(root, "api-specification")
    if (!existsSync(dir)) return []
    return readdirSync(dir).filter((f) => /\.(json|ya?ml)$/i.test(f)).sort().map((f) => join(dir, f))
  }
  const contracts = findContracts()
  if (!contracts.length) { note("машиночитаемый контракт не найден — пропуск (нечего диффить)"); process.exit(0) }

  // Реальный внешний раннер: пишет prev/next во временные файлы и зовёт отраслевой тул.
  const runExternal = (format, prevText, nextText, rel) => {
    const dir = mkdtempSync(join(tmpdir(), "cdiff-"))
    const ext = extname(rel) || (format === "asyncapi" ? ".yaml" : ".yaml")
    const base = join(dir, "base" + ext), rev = join(dir, "rev" + ext)
    writeFileSync(base, prevText); writeFileSync(rev, nextText)
    try {
      if (format === "openapi") {
        // oasdiff breaking base rev --fail-on ERR: exit≠0 когда есть ERR-уровень ломающих.
        try {
          execFileSync("oasdiff", ["breaking", base, rev, "--fail-on", "ERR"], { encoding: "utf8" })
          return { breaking: false, lines: [] }
        } catch (e) {
          if (typeof e.status === "number" && e.status !== 0 && e.stdout != null)
            return { breaking: true, lines: String(e.stdout).trim().split("\n").filter(Boolean) }
          throw e // подлинный сбой запуска (не «нашлись ломающие») → fail-closed выше
        }
      }
      if (format === "asyncapi") {
        const out = execFileSync("asyncapi", ["diff", base, rev, "--type", "breaking"], { encoding: "utf8" })
        const breaking = out.trim().length > 0 && !/no breaking|no changes/i.test(out)
        return { breaking, lines: breaking ? out.trim().split("\n").filter(Boolean) : [] }
      }
      throw new Error(`нет внешнего раннера для формата ${format}`)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  }

  let worst = 0
  for (const contract of contracts) {
    const rel = relative(root, contract)
    if (!existsSync(contract)) { note(`контракт ${rel} не найден — пропуск`); continue }
    const nextText = readFileSync(contract, "utf8")
    const format = detectFormat(rel, nextText)
    if (format === "unknown") { note(`формат ${rel} не распознан (не openapi/asyncapi/json-schema) — пропуск`); continue }

    // база = прошлая версия из git HEAD; нет базы → новый контракт, диффить не с чем (не блокируем)
    let prevText
    try { prevText = execSync(`git show HEAD:${JSON.stringify(rel)}`, { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }) }
    catch { note(`прошлой версии ${rel} в git HEAD нет (новый контракт?) — нет базы для diff, пропуск`); continue }

    const { code, lines } = dispatchContract({ rel, format, prevText, nextText }, { hasBinary: binaryInPath, runExternal })
    for (const l of lines) note(l)
    worst = Math.max(worst, code)
  }
  process.exit(worst) // 0 = совместимо/нет базы/не распознан · 2 = breaking ИЛИ fail-closed
}
