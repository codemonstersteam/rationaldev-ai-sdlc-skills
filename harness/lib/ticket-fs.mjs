// Обнаружение тикетов по проекту (fs-часть; чистая структурная логика — в validators.mjs).
// ЕДИНЫЙ источник раскладки тикетов, чтобы validate-tickets и validate-plan не дублировали цикл
// и оба видели change-scoped доработки.
//
// Раскладка (природа работы → её durable папка):
//   greenfield: docs/design/slice-<slug>/tickets/ticket-N.md         — сборка слайса (неизменная запись)
//   rework:     docs/design/slice-<slug>/changes/<NNN-slug>/tickets/  — доработка слайса (modify-тикеты)
// Machines slug-агностичны: глобим на уровень глубже, имя папки не парсим.
import { readdirSync, existsSync } from "node:fs"
import { join } from "node:path"

// Все каталоги тикетов ОДНОГО слайса: собственный greenfield tickets/ + каждый changes/<slug>/tickets/.
// → [{ dir: <abs>, rel: <человекочитаемый rel от корня проекта> }] в стабильном порядке (own, затем changes отсортированы).
export function sliceTicketDirs(designAbs, slice) {
  const out = []
  const own = join(designAbs, slice, "tickets")
  if (existsSync(own)) out.push({ dir: own, rel: join("docs/design", slice, "tickets") })
  const changesRoot = join(designAbs, slice, "changes")
  if (existsSync(changesRoot)) {
    for (const change of readdirSync(changesRoot).sort()) {
      const td = join(changesRoot, change, "tickets")
      if (existsSync(td)) out.push({ dir: td, rel: join("docs/design", slice, "changes", change, "tickets") })
    }
  }
  return out
}

// Все тикет-файлы проекта: по всем слайсам, greenfield + change-scoped.
// → [{ rel, abs }] отсортированы по слайсу, затем по имени файла.
export function discoverTicketFiles(root) {
  const files = []
  const design = join(root, "docs", "design")
  if (!existsSync(design)) return files
  for (const slice of readdirSync(design).filter((d) => d.startsWith("slice-")).sort()) {
    for (const { dir, rel } of sliceTicketDirs(design, slice)) {
      for (const f of readdirSync(dir).filter((f) => f.endsWith(".md")).sort())
        files.push({ rel: join(rel, f), abs: join(dir, f) })
    }
  }
  return files
}
