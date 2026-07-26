// Установка возвращает клон в pristine, откатывая ГЕНЕРЁННЫЕ пути. Регрессия: откатывался
// `harness/agents` целиком, а внутри — `_shared/`, ИСТОЧНИК ПРАВДЫ ролей. Любая незакоммиченная
// правка роли молча исчезала при `install.sh` / `sh harness/smoke/run.sh` (наблюдалась потеря работы).
// Проверяем оба установщика: источник не в списке отката, генерируемые пути — в списке.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const sh = readFileSync(join(ROOT, "install.sh"), "utf8")
const ps1 = readFileSync(join(ROOT, "install.ps1"), "utf8")
// Строки отката: `git … checkout -- <пути>` (в install.sh продолжается на следующую строку).
const restoreLines = (src) => src.split("\n").reduce((acc, line, i, all) => {
  if (!/checkout\s+--/.test(line)) return acc
  const cont = line.trim().endsWith("\\") ? " " + (all[i + 1] || "") : ""
  return acc.concat(line + cont)
}, [])

for (const [name, src] of [["install.sh", sh], ["install.ps1", ps1]]) {
  test(`${name}: источник правды ролей НЕ откатывается (правки переживают установку)`, () => {
    const lines = restoreLines(src)
    assert.ok(lines.length, "не нашёл строку восстановления pristine — тест устарел?")
    for (const l of lines) {
      assert.doesNotMatch(l, /checkout\s+--\s+harness\/agents(\s|$)/,
        `слепой откат harness/agents стирает harness/agents/_shared — источник правды ролей:\n  ${l}`)
      assert.doesNotMatch(l, /harness\/agents\/_shared/, `_shared в списке отката:\n  ${l}`)
    }
  })

  test(`${name}: генерируемые проекции откатываются (клон остаётся pristine для update)`, () => {
    const all = restoreLines(src).join(" ")
    for (const p of ["harness/agents/claude", "harness/agents/codex", "harness/agents/opencode", "skills/roles"])
      assert.ok(all.includes(p), `${p} — генерируемый путь, его откат держит клон pristine`)
  })
}
