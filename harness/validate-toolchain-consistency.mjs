// CLI-оболочка (I/O) toolchain-консистентности. Логика — lib/validators.mjs (чисто).
// Профиль (target-profiles.json .toolchain[]) объявляет ИСТОЧНИКИ версии тулчейна
// (go.mod go-директива · Dockerfile golang-база); валидатор требует ЕДИНОЙ версии во
// всех → скос (напр. go.mod 1.25 ↔ Dockerfile golang:1.24, или main go.mod ↔ component-tests
// go.mod) = BLOCKER. Ловит эпизод «fagan чинит докер» ДО семантического прохода @fagan.
//
// Версия-агностично: ни `go`, ни версий в коде — версия это ДАННЫЕ (файлы проекта + профиль),
// тут лишь ГДЕ её искать. Другой стек = свой toolchain[] в его профиле, 0 правок валидатора.
//
// Запуск: node harness/validate-toolchain-consistency.mjs [dir]   (dir — корень проекта, по умолчанию cwd)
// exit 0 = единый тулчейн (или профиль без toolchain-источников); exit 1 = скос (список версий→файлы).
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { loadProfile, collectFiles } from "./validate-dod.mjs"
import { validateToolchainConsistency, extractToolchainVersions } from "./lib/validators.mjs"

const root = process.argv[2] || process.cwd()
const profile = loadProfile(root)
const sources = profile.toolchain || []

// читаем ТОЛЬКО файлы-источники версии (go.mod, Dockerfile), не весь проект
const fileRes = sources.map((s) => { try { return new RegExp(s.file, "i") } catch { return null } }).filter(Boolean)
const entries = collectFiles(root)
  .filter((p) => fileRes.some((re) => re.test(p)))
  .map((p) => { try { return { path: p, content: readFileSync(join(root, p), "utf8") } } catch { return { path: p, content: "" } } })

const errors = validateToolchainConsistency(entries, sources)
if (errors.length) {
  console.error("validate-toolchain-consistency: СКОС ТУЛЧЕЙНА (Gate #1 / DoD blocker):")
  for (const e of errors) console.error(`  ✗ ${e}`)
  console.error("  → бампи go.mod + все *(/)go.mod + все Dockerfile-базы ОДНОЙ версией единым фронтом; затем ре-валидируй.")
  process.exit(1)
}
const found = extractToolchainVersions(entries, sources)
const v = found.length ? [...new Set(found.map((f) => f.version))][0] : "нет toolchain-источников в профиле/проекте"
console.log(`validate-toolchain-consistency: OK — единый тулчейн (${v}) в ${found.length} источник(ах).`)
