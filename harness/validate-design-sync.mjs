// Гейт «канон живой»: пакет среза описывает ТЕКУЩЕЕ состояние, change-папка — провенанс
// (`docs/05_REPO_STRUCTURE.md`, правило размещения по весу). Дельта, тронувшая карту дизайна, обязана
// быть сведена в одноимённый файл канона, а канон — нести маркер этой дельты:
//   > Current as of change <NNN-slug> (lane <вес>)
// Иначе читатель берёт сигнатуры из канона и проектирует по отменённому (наблюдение прогона
// pinout-asyncapi: `module-tree.md` среза объяснял узлы, которых в коде уже нет).
//
// Проверка МЕХАНИЧЕСКАЯ, без разбора прозы: наличие файла-близнеца + наличие маркера с именем дельты.
// «Сведено ли по смыслу» — суждение, оно у @fagan; скрипт ловит только молчаливое расхождение.
//
// Запуск: node harness/validate-design-sync.mjs [projectRoot]
// exit 0 = канон синхронен (или сводить нечего) · exit 1 = дельта не сведена / нет маркера.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs"
import { join } from "node:path"

// Карты дизайна, которые обязаны существовать в обеих формах. ADR не здесь: он аддитивен
// (новое решение не отменяет старое), сведение ADR — суждение автора, не механика.
export const SYNCED_MAPS = ["module-tree.md", "contracts.md", "c4.md"]

// Маркер актуальности в шапке канона. Имя дельты обязано совпадать с папкой изменения — иначе
// «Current as of» указывает на чужой прогон и врёт с тем же успехом, что и его отсутствие.
export function markerRe(changeSlug) {
  const esc = String(changeSlug).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")   // слаг в regex — литералом
  return new RegExp("Current as of change[^\\n]*" + esc, "i")
}

// Чистое ядро: по составу дельты и содержимому канона сказать, что не сведено.
// changes :: [{ slug, maps: [имена карт в дельте] }] · canon :: (map) -> string|null (содержимое или null)
export function syncViolations(changes, canon) {
  const out = []
  for (const { slug, maps } of changes) {
    for (const map of maps) {
      const text = canon(map)
      if (text === null || text === undefined) {
        out.push({ slug, map, why: "дельта тронула карту, а в каноне среза её нет" })
        continue
      }
      if (!markerRe(slug).test(text)) {
        out.push({ slug, map, why: `в каноне нет маркера «Current as of change ${slug}» — дельта не сведена` })
      }
    }
  }
  return out
}

// ── io-оболочка ─────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && process.argv[1].endsWith("validate-design-sync.mjs")
if (isMain) {
  const root = process.argv[2] || process.cwd()
  const design = join(root, "docs", "design")
  const dirs = (p) => { try { return readdirSync(p).filter((d) => statSync(join(p, d)).isDirectory()) } catch { return [] } }

  let checked = 0
  const violations = []
  for (const slice of dirs(design).filter((d) => d.startsWith("slice-"))) {
    const changesRoot = join(design, slice, "changes")
    const changes = dirs(changesRoot).map((slug) => ({
      slug,
      maps: SYNCED_MAPS.filter((m) => existsSync(join(changesRoot, slug, m))),
    })).filter((c) => c.maps.length)
    if (!changes.length) continue
    checked += changes.length
    const canon = (map) => { const p = join(design, slice, map); return existsSync(p) ? readFileSync(p, "utf8") : null }
    for (const v of syncViolations(changes, canon)) violations.push({ slice, ...v })
  }

  if (violations.length) {
    console.error("validate-design-sync: канон среза разошёлся с принятой дельтой:")
    for (const v of violations) console.error(`  ✗ ${v.slice}/${v.map} · дельта ${v.slug} — ${v.why}`)
    console.error("  → сведи дельту в канон (@wirth-moduledesigner, mode=canon-sync) и поставь в шапке")
    console.error("    маркер: > Current as of change <NNN-slug> (lane <вес>). Change-папку не переписывай.")
    process.exit(1)
  }
  console.log(`validate-design-sync: OK — канон синхронен (проверено дельт: ${checked})`)
  process.exit(0)
}
