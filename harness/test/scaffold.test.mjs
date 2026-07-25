// scaffold.sh: шаблон ДОПОЛНЯЕТ проект, а не диктует ему. Два закона проекта, которых универсальный
// шаблон не знает: .gitignore (правила проекта) и раскладка internal/<slug>/ (validate-layout).
// Первое — .gitignore ДОПОЛНЯЕТСЯ, а не затирается. Регрессия живого прогона
// pinout-asyncapi: Go-шаблон снёс строки харнеса (.agent/, .claude/, harness, CLAUDE.md), и состояние
// прогона вместе с симлинками установки поехало бы в PR через `git add -A` у @git-hand.
// Тест функциональный: настоящий git-шаблон во временном каталоге, настоящий запуск scaffold.sh.
// Билд в конце скрипта нам безразличен (Go в шаблоне нет) — проверяем состояние дерева, не код возврата.
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const SCAFFOLD = join(dirname(fileURLToPath(import.meta.url)), "..", "scaffold.sh")

// git-шаблон: go.mod (scaffold.sh требует `module`) + свой .gitignore [+ плейсхолдер-пакет].
function template(ignoreLines, { placeholder = null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "scaffold-tpl-"))
  const git = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8" })
  writeFileSync(join(dir, "go.mod"), "module tpl\n\ngo 1.25\n")
  writeFileSync(join(dir, ".gitignore"), ignoreLines.join("\n") + "\n")
  if (placeholder) {
    mkdirSync(join(dir, "internal", placeholder, "io"), { recursive: true })
    mkdirSync(join(dir, "internal", "shared", "config"), { recursive: true })
    mkdirSync(join(dir, "cmd", "app"), { recursive: true })
    writeFileSync(join(dir, "internal", placeholder, "run.go"), `package ${placeholder}\n`)
    writeFileSync(join(dir, "internal", placeholder, "io", "io.go"), "package io\n")
    writeFileSync(join(dir, "internal", "shared", "config", "config.go"), "package config\n")
    writeFileSync(join(dir, "cmd", "app", "main.go"),
      `package main\n\nimport (\n\t"tpl/internal/${placeholder}"\n\txio "tpl/internal/${placeholder}/io"\n\t"tpl/internal/shared/config"\n)\n`)
  }
  git("init", "--quiet")
  git("config", "user.email", "t@t"); git("config", "user.name", "t")
  git("add", "-A"); git("commit", "--quiet", "-m", "tpl")
  return dir
}

const run = (dest, tpl) => spawnSync("sh", [SCAFFOLD, "svc", tpl], { cwd: dest, encoding: "utf8" })

test("scaffold: .gitignore проекта СОХРАНЯЕТСЯ, шаблонные строки дописываются", () => {
  const tpl = template(["# Go", "*.test", "/dist/"])
  const dest = mkdtempSync(join(tmpdir(), "scaffold-dest-"))
  mkdirSync(join(dest, ".agent", "planner"), { recursive: true })
  writeFileSync(join(dest, ".gitignore"), ".agent/\n.claude/\n/harness\n/CLAUDE.md\n")

  const out = run(dest, tpl)
  const ignore = readFileSync(join(dest, ".gitignore"), "utf8")

  for (const line of [".agent/", ".claude/", "/harness", "/CLAUDE.md"])
    assert.ok(ignore.includes(line), `правило проекта '${line}' затёрто шаблоном — состояние прогона уедет в PR`)
  assert.match(ignore, /\*\.test/, "шаблонные правила должны быть дописаны")
  assert.match(ignore, /\/dist\//)
  assert.match(out.stdout, /слит/, "слияние называется вслух")
  rmSync(tpl, { recursive: true, force: true }); rmSync(dest, { recursive: true, force: true })
})

test("scaffold: дубликаты не плодятся (повторный прогон идемпотентен по .gitignore)", () => {
  const tpl = template(["*.test", "/dist/"])
  const dest = mkdtempSync(join(tmpdir(), "scaffold-dest2-"))
  writeFileSync(join(dest, ".gitignore"), ".agent/\n*.test\n")

  run(dest, tpl)
  run(dest, tpl)
  const lines = readFileSync(join(dest, ".gitignore"), "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("#"))
  const counts = lines.reduce((a, l) => ({ ...a, [l]: (a[l] || 0) + 1 }), {})
  for (const [line, n] of Object.entries(counts)) assert.equal(n, 1, `строка '${line}' продублирована ×${n}`)
  rmSync(tpl, { recursive: true, force: true }); rmSync(dest, { recursive: true, force: true })
})

test("scaffold: .gitignore проекта НЕТ → шаблонный кладётся как есть", () => {
  const tpl = template(["*.test"])
  const dest = mkdtempSync(join(tmpdir(), "scaffold-dest3-"))
  run(dest, tpl)
  assert.match(readFileSync(join(dest, ".gitignore"), "utf8"), /\*\.test/)
  rmSync(tpl, { recursive: true, force: true }); rmSync(dest, { recursive: true, force: true })
})

// ── плейсхолдер шаблона против закона раскладки (validate-layout) ────────────────
// Прогон pinout-asyncapi: internal/example/ шаблона — layer-keyed для валидатора, но ЖИВОЙ (main.go
// импортирует, смоук на нём зелёный). Удаление уронило бы смоук, бездействие — гейт на каждом тикете.

const slices = (dest, slugs) => {
  mkdirSync(join(dest, ".agent", "planner"), { recursive: true })
  writeFileSync(join(dest, ".agent", "planner", "slices.md"),
    slugs.map((s, i) => `## Срез ${i + 1}\nOwns package: \`internal/${s}/\`\n`).join("\n"))
}

test("scaffold: плейсхолдер шаблона переименован в пакет объявленного среза", () => {
  const tpl = template(["*.test"], { placeholder: "example" })
  const dest = mkdtempSync(join(tmpdir(), "scaffold-ph-"))
  slices(dest, ["validate"])

  const out = run(dest, tpl)
  assert.ok(!existsSync(join(dest, "internal", "example")), "плейсхолдер не должен остаться — validate-layout красный")
  assert.ok(existsSync(join(dest, "internal", "validate", "io")), "содержимое переехало целиком (подпакеты тоже)")
  assert.ok(existsSync(join(dest, "internal", "shared", "config")), "internal/shared/ законен — не трогаем")
  const main = readFileSync(join(dest, "cmd", "app", "main.go"), "utf8")
  assert.match(main, /internal\/validate"/, "импорты переписаны — сборка не ломается")
  assert.doesNotMatch(main, /internal\/example/)
  assert.match(out.stdout, /плейсхолдер internal\/example\/ → internal\/validate\//)
  rmSync(tpl, { recursive: true, force: true }); rmSync(dest, { recursive: true, force: true })
})

test("🔴 срезов не один → НЕ угадываем: плейсхолдер на месте + громкое предупреждение", () => {
  const tpl = template(["*.test"], { placeholder: "example" })
  const dest = mkdtempSync(join(tmpdir(), "scaffold-ph2-"))
  slices(dest, ["validate", "report"])

  const out = run(dest, tpl)
  assert.ok(existsSync(join(dest, "internal", "example")), "молча приписать срез нельзя — это суждение, а не механика")
  assert.match(out.stdout, /ВНИМАНИЕ.*вне объявленных срезов/s, "конфликт назван вслух, а не оставлен на @linger")
  rmSync(tpl, { recursive: true, force: true }); rmSync(dest, { recursive: true, force: true })
})

test("scaffold: пакет уже названный срезом не трогается (идемпотентность)", () => {
  const tpl = template(["*.test"], { placeholder: "validate" })
  const dest = mkdtempSync(join(tmpdir(), "scaffold-ph3-"))
  slices(dest, ["validate"])

  run(dest, tpl)
  assert.ok(existsSync(join(dest, "internal", "validate", "io")))
  assert.match(readFileSync(join(dest, "cmd", "app", "main.go"), "utf8"), /internal\/validate"/)
  rmSync(tpl, { recursive: true, force: true }); rmSync(dest, { recursive: true, force: true })
})
