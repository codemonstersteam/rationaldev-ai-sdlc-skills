// Валидатор ПОЛНОТЫ восстановленного/сведённого дизайн-пакета + РАЗМЕТКИ ПРОВЕНАНСА (пакет 2, P1–P3).
// НЕ подменяет validate-contract-frozen / validate-dod — проверяет только, что артефакты пакета на
// месте и КАЖДАЯ запись помечена. Обязательный под-шаг Gate #1: @mills ревьюит полноту пакета через
// этот гейт (артефакты + провенанс), это часть Gate #1, не новый гейт.
//
// Проверяет (§«validate-package.mjs» контракта p1-3):
//   • docs/design/slice-*/ содержит module-tree.md, contracts.md, c4.md;
//   • корневой CONTEXT.md есть (при ≥2 CONTEXT.md — учитывается мульти-контекст: нужна CONTEXT-MAP.md);
//   • api-specification/ непуст;
//   • КАЖДАЯ запись пакета несёт inline-провенанс `[as-is]` | `[gap: <…>]` — непомеченных нет.
//
// Провенанс — формат (§«Провенанс — формат», единый для всех трёх пакетов): каждая запись
// восстановленного пакета несёт inline-маркер `[as-is]` (как реально построено) ЛИБО
// `[gap: <в чём расхождение>]` (расходится с задокументированным поведением / текущим стандартом).
// `[gap]` — заметка/долг оператору, НЕ «починка задним числом».
//
// Чистое ядро (io: none) — принимает СТРУКТУРУ и СОДЕРЖИМОЕ аргументами, юнит-тестируемо. Тонкий
// CLI-хвост читает fs. Запуск: node harness/validate-package.mjs [projectRoot]  (по умолч. cwd).
// exit 0 = пакет полон и размечен; exit 1 = чего-то нет / есть непомеченные записи (stderr перечисляет).
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs"
import { join, relative } from "node:path"

// --- Провенанс-маркер (единый формат) ------------------------------------------------------------
// `[as-is]` ЛИБО `[gap]` / `[gap: <текст>]`. Регистронезависимо.
export const PROVENANCE_RE = /\[as-is\]|\[gap\b[^\]]*\]/i

// Обязательные файлы дизайн-пакета в каждом срезе docs/design/slice-*/.
export const SLICE_REQUIRED = ["module-tree.md", "contracts.md", "c4.md"]

// --- Полнота пакета (чисто) ----------------------------------------------------------------------
// structure: {
//   slices:       [{ slug, files: string[] }]  — какие файлы реально лежат в docs/design/slice-<slug>/
//   hasContext:   bool                          — корневой CONTEXT.md существует
//   hasContextMap:bool                          — CONTEXT-MAP.md существует
//   contextCount: number                        — сколько CONTEXT.md всего (root + по срезам)
//   apiSpecFiles: string[]                       — содержимое api-specification/ (непусто?)
// }
export function checkPackageCompleteness(structure) {
  const errors = []
  const slices = (structure && structure.slices) || []
  if (!slices.length) {
    errors.push("нет ни одного docs/design/slice-*/ — дизайн-пакет не восстановлен")
  }
  for (const s of slices) {
    const have = new Set(s.files || [])
    for (const req of SLICE_REQUIRED)
      if (!have.has(req)) errors.push(`docs/design/slice-${s.slug}/: нет ${req}`)
  }
  if (!structure || !structure.hasContext) errors.push("нет корневого CONTEXT.md")
  // Мульти-контекст: ≥2 CONTEXT.md → root CONTEXT-MAP.md обязателен (карта контекстов не потеряна).
  if (structure && (structure.contextCount || 0) >= 2 && !structure.hasContextMap)
    errors.push(`≥2 CONTEXT.md (${structure.contextCount}), но нет CONTEXT-MAP.md — мульти-контекст не сведён`)
  if (!structure || !((structure.apiSpecFiles || []).length))
    errors.push("api-specification/ пуст или отсутствует")
  return errors
}

// --- Разметка провенанса (чисто) -----------------------------------------------------------------
// «Запись» пакета = markdown-элемент списка ЛИБО строка-данные таблицы (не заголовок таблицы, не
// строка-разделитель `|---|`, вне ```-code-fence). Каждая такая запись ОБЯЗАНА нести провенанс-маркер.
// Заголовки (`#`), проза, пустые строки, code-fence — не «записи», их не требуем метить.
// files: [{ path, content }] → массив непомеченных [{ path, line, text }] (line — 1-based).
const isListItem = (l) => /^\s*([-*+]|\d+[.)])\s+\S/.test(l)
const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l)
const isTableSeparator = (l) => /^\s*\|[\s|:-]*-[\s|:-]*\|\s*$/.test(l)
function isEntryLine(line, next) {
  if (isListItem(line)) return true
  if (isTableRow(line)) {
    if (isTableSeparator(line)) return false // сам разделитель `|---|---|` — не запись
    if (next != null && isTableSeparator(next)) return false // строка-заголовок (перед разделителем)
    return true // строка-данные таблицы
  }
  return false
}
export function findUnmarkedEntries(files) {
  const unmarked = []
  for (const { path, content } of files || []) {
    const lines = String(content).replace(/\r\n/g, "\n").split("\n")
    let inFence = false
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue } // граница code-fence
      if (inFence) continue
      if (!isEntryLine(line, lines[i + 1])) continue
      if (!PROVENANCE_RE.test(line)) unmarked.push({ path, line: i + 1, text: line.trim() })
    }
  }
  return unmarked
}

// --- Оркестрация ядра (чисто) --------------------------------------------------------------------
export function validatePackage(structure, files) {
  return {
    completeness: checkPackageCompleteness(structure),
    unmarked: findUnmarkedEntries(files),
  }
}

// --- CLI-хвост (I/O) -----------------------------------------------------------------------------
if (process.argv[1] && process.argv[1].endsWith("validate-package.mjs")) {
  const root = process.argv[2] || process.cwd()
  const designDir = join(root, "docs", "design")

  // 1) срезы docs/design/slice-*/ + их файлы
  const slices = []
  if (existsSync(designDir) && statSync(designDir).isDirectory()) {
    for (const d of readdirSync(designDir)) {
      if (!d.startsWith("slice-")) continue
      const sdir = join(designDir, d)
      if (!statSync(sdir).isDirectory()) continue
      const files = readdirSync(sdir).filter((f) => { try { return statSync(join(sdir, f)).isFile() } catch { return false } })
      slices.push({ slug: d.replace(/^slice-/, ""), dir: sdir, files })
    }
  }

  // 2) контексты
  const rootContext = join(root, "CONTEXT.md")
  const hasContext = existsSync(rootContext)
  const hasContextMap = existsSync(join(root, "CONTEXT-MAP.md"))
  let contextCount = hasContext ? 1 : 0
  for (const s of slices) if (s.files.includes("CONTEXT.md")) contextCount++

  // 3) api-specification/ (непусто?)
  const apiDir = join(root, "api-specification")
  const apiSpecFiles = existsSync(apiDir) && statSync(apiDir).isDirectory()
    ? readdirSync(apiDir).filter((f) => !f.startsWith("."))
    : []

  // 4) файлы-носители провенанса — проза пакета (не api-spec-yaml): root CONTEXT/CONTEXT-MAP +
  //    module-tree/contracts/c4/CONTEXT каждого среза
  const provFiles = []
  const pushFile = (abs) => {
    try { if (existsSync(abs) && statSync(abs).isFile()) provFiles.push({ path: relative(root, abs) || abs, content: readFileSync(abs, "utf8") }) } catch { /* noop */ }
  }
  pushFile(rootContext)
  pushFile(join(root, "CONTEXT-MAP.md"))
  for (const s of slices) for (const f of [...SLICE_REQUIRED, "CONTEXT.md"]) pushFile(join(s.dir, f))

  const structure = { slices: slices.map((s) => ({ slug: s.slug, files: s.files })), hasContext, hasContextMap, contextCount, apiSpecFiles }
  const { completeness, unmarked } = validatePackage(structure, provFiles)

  if (completeness.length || unmarked.length) {
    console.error("validate-package: дизайн-пакет НЕ полон / есть непомеченные записи:")
    for (const e of completeness) console.error(`  ✗ ${e}`)
    for (const u of unmarked)
      console.error(`  ✗ ${u.path}:${u.line} — запись без провенанса [as-is]|[gap: …]: «${u.text.slice(0, 70)}»`)
    console.error("  → пакет обязан быть полон (module-tree/contracts/c4 + CONTEXT + api-spec) и КАЖДАЯ запись помечена [as-is]|[gap].")
    process.exit(1)
  }
  console.log(`validate-package: OK — пакет полон и размечен (срезов: ${slices.length}, api-spec-записей: ${apiSpecFiles.length}, провенанс-файлов: ${provFiles.length})`)
}
