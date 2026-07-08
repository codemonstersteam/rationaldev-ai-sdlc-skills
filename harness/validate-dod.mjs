// CLI-оболочка детерминированного DoD-гейта приёмки (@fagan, перед Gate #2). Зеркалит
// МЕХАНИЧЕСКИЕ пункты TASK §Definition of done: build+unit зелёные · обязательные артефакты
// (openapi/Dockerfile/compose/run-tests/README) присутствуют · README несёт обязательные
// заголовки (вкл. `## Карта режимов отказа`) · --run прогоняет ./run-tests.sh (docker godog).
// СЕМАНТИКУ (верность README реальному сервису, no-hardcode) валидатор НЕ трогает — это
// вердикт @fagan (large-model). Прогон валидатора ≠ приёмка: он лишь очищает механический пол.
//
// Запуск: node harness/validate-dod.mjs [dir] [--slice <slug>] [--run]
//   dir      — корень сервиса (по умолчанию cwd)
//   --slice  — slug среза (справочно, для сообщений)
//   --run    — дополнительно выполнить run-tests.sh (docker); без него — только presence/структура
// exit 0 = все механические DoD-пункты зелёные; exit 1 = список проваленных пунктов в stderr.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { execSync } from "node:child_process"

// ── чистые/fs-хелперы (покрыты смоуком) ─────────────────────────────────────
const SKIP = new Set([".git", "vendor", "node_modules", ".agent", ".opencode", "harness"])

export function collectFiles(root) {           // рекурсивный обход файлов сервиса (без мусорных дерев)
  const out = []
  const walk = (dir) => {
    let ents
    try { ents = readdirSync(dir) } catch { return }
    for (const name of ents) {
      if (SKIP.has(name)) continue
      const abs = join(dir, name)
      let st
      try { st = statSync(abs) } catch { continue }
      if (st.isDirectory()) walk(abs)
      else out.push(relative(root, abs))
    }
  }
  walk(root)
  return out
}

// обязательные артефакты как паттерны имени пути (root ИЛИ component-tests/… — раскладка гибкая)
export const ARTIFACTS = [
  ["OpenAPI contract",   /(^|\/)api-specification\/.*openapi\.ya?ml$/i],
  ["Dockerfile",         /(^|\/)[^/]*Dockerfile[^/]*$/i],
  ["docker-compose",     /(^|\/)docker-compose[^/]*\.ya?ml$/i],
  ["run-tests.sh",       /(^|\/)run-tests\.sh$/i],
  ["README.md",          /^README\.md$/i],
  ["Gherkin feature",    /\.feature$/i],
]

export function missingArtifacts(files) {      // → [метка,…] отсутствующих обязательных артефактов
  return ARTIFACTS.filter(([, re]) => !files.some((f) => re.test(f))).map(([label]) => label)
}

// обязательные заголовки/секции README (структура, НЕ содержание)
export const README_SECTIONS = [
  ["Карта режимов отказа", /Карта\s+режимов\s+отказа/i],
  ["API section",          /(#+\s*API\b)|(\bGET\s+\/\w)/],
  ["build/run section",    /#+\s*(build|run|usage|getting started|сборк|запуск|установ)/i],
]

export function missingReadmeSections(readmeText) {
  return README_SECTIONS.filter(([, re]) => !re.test(readmeText)).map(([label]) => label)
}

// ── исполнение (impure) ─────────────────────────────────────────────────────
function run(cmd, cwd) {                        // → {ok, out}; НЕ бросает
  try { return { ok: true, out: execSync(cmd, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString() } }
  catch (e) { return { ok: false, out: (e.stdout?.toString() || "") + (e.stderr?.toString() || e.message || "") } }
}

// запуск как модуля (не при импорте смоуком)
const invokedDirectly = process.argv[1] && process.argv[1].endsWith("validate-dod.mjs")
if (invokedDirectly) {
  const argv = process.argv.slice(2)
  const doRun = argv.includes("--run")
  const sliceIdx = argv.indexOf("--slice")
  const slug = sliceIdx >= 0 ? argv[sliceIdx + 1] : ""
  const pos = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--slice")
  const root = pos[0] || process.cwd()

  const fails = []   // [пункт → что не так]

  // 1) build + unit
  if (!existsSync(join(root, "go.mod"))) fails.push("build: нет go.mod (не Go-модуль?)")
  else {
    const b = run("go build ./...", root); if (!b.ok) fails.push("go build ./... FAIL:\n" + b.out.trim())
    const t = run("go test ./...", root);  if (!t.ok) fails.push("go test ./... FAIL:\n" + t.out.trim())
  }

  // 2) обязательные артефакты
  const files = collectFiles(root)
  for (const m of missingArtifacts(files)) fails.push(`артефакт отсутствует: ${m}`)

  // 3) README-структура (только если README есть)
  const readme = join(root, "README.md")
  if (existsSync(readme))
    for (const s of missingReadmeSections(readFileSync(readme, "utf8"))) fails.push(`README без секции: ${s}`)

  // 4) --run: ./run-tests.sh exits 0 (docker godog)
  if (doRun) {
    const rt = files.find((f) => /(^|\/)run-tests\.sh$/i.test(f))
    if (!rt) fails.push("--run: run-tests.sh не найден")
    else { const r = run(`sh ${JSON.stringify(rt)}`, root); if (!r.ok) fails.push("run-tests.sh exit≠0:\n" + r.out.trim().slice(-800)) }
  }

  if (fails.length) {
    console.error(`validate-dod: DoD НЕ закрыт${slug ? ` (срез ${slug})` : ""} — ${fails.length} пункт(ов):`)
    for (const f of fails) console.error(`  ✗ ${f}`)
    console.error("  → @fagan: НЕ снимать @wip, НЕ принимать; вернуть FAIL izi → @linger.")
    process.exit(1)
  }
  console.log(`validate-dod: OK — механический DoD закрыт${slug ? ` (срез ${slug})` : ""}${doRun ? " + run-tests зелёный" : " (presence-режим, без --run)"}.`)
}
