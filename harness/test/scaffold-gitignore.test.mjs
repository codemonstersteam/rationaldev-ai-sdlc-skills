// scaffold.sh и .gitignore проекта: шаблон ДОПОЛНЯЕТ, а не затирает. Регрессия живого прогона
// pinout-asyncapi: Go-шаблон снёс строки харнеса (.agent/, .claude/, harness, CLAUDE.md), и состояние
// прогона вместе с симлинками установки поехало бы в PR через `git add -A` у @git-hand.
// Тест функциональный: настоящий git-шаблон во временном каталоге, настоящий запуск scaffold.sh.
// Билд в конце скрипта нам безразличен (Go в шаблоне нет) — проверяем состояние дерева, не код возврата.
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const SCAFFOLD = join(dirname(fileURLToPath(import.meta.url)), "..", "scaffold.sh")

// git-шаблон: go.mod (scaffold.sh требует `module`) + свой .gitignore.
function template(ignoreLines) {
  const dir = mkdtempSync(join(tmpdir(), "scaffold-tpl-"))
  const git = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8" })
  writeFileSync(join(dir, "go.mod"), "module example.com/tpl\n\ngo 1.25\n")
  writeFileSync(join(dir, ".gitignore"), ignoreLines.join("\n") + "\n")
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
