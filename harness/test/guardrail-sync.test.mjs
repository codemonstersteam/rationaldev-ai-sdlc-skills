// Плагин rational-guardrail.mjs: (1) exports ТОЛЬКО функции (загрузчик opencode перебирает Object.values
// и падает "Plugin export is not a function" на любом non-function export); (2) инлайн-копия чистых
// функций/констант из ../enforcement/shared.mjs должна совпадать (единый источник для claude-хуков).
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import * as PLUGIN from "../enforcement/opencode/rational-guardrail.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const sharedSrc = readFileSync(join(HERE, "..", "enforcement", "shared.mjs"), "utf8")
const pluginSrc = readFileSync(join(HERE, "..", "enforcement", "opencode", "rational-guardrail.mjs"), "utf8")

// (1) КОНТРАКТ ЗАГРУЗЧИКА opencode: каждый export — функция ИЛИ { server: fn }. Иначе TypeError на загрузке.
test("opencode-loader: все exports плагина — функции (не Set/массив/строка)", () => {
  const bad = Object.entries(PLUGIN).filter(([, v]) => !(typeof v === "function" || (v && typeof v.server === "function")))
  assert.deepEqual(bad.map(([k]) => k), [], "non-function exports сломают загрузчик opencode ('Plugin export is not a function')")
  assert.ok(typeof PLUGIN.RationalGuardrail === "function", "RationalGuardrail экспортирован как функция")
})

// (2) DRIFT: инлайн ≡ shared.mjs ПО ЛОГИКЕ (не по форматированию). Снимаем комменты (после пробела/начала
// строки — регэкспы с `\/` не трогаем) и схлопываем пробелы, потом извлекаем декларацию по имени и сравниваем.
const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[\s;(,{[])\/\/[^\n]*/g, "$1")
function decl(rawText, name) {
  const lines = stripComments(rawText).split("\n")
  const re = new RegExp(`^(export\\s+)?(function\\s+${name}\\b|const\\s+${name}\\s*=)`)
  const start = lines.findIndex((l) => re.test(l))
  if (start < 0) return null
  let depth = 0, out = []
  for (let i = start; i < lines.length; i++) {
    out.push(lines[i])
    for (const ch of lines[i]) {
      if (ch === "{" || ch === "(" || ch === "[") depth++
      else if (ch === "}" || ch === ")" || ch === "]") depth--
    }
    if (depth <= 0) break
  }
  return out.join("\n").replace(/^export\s+/, "").replace(/\s+/g, " ").trim()   // нормализуем пробелы
}

const INLINED = [
  "GATE_MARK", "PIPELINE", "IMPLEMENTERS", "requiresFrontDoor", "TRUNK_BRANCHES", "branchFromHead",
  "isTrunkBranch", "PLAN_REVIEW_MARK", "DESIGN_DIR", "CHORES_DIR", "CHORE_PLAN_FILE", "isChoreMode",
  "hasChorePlan", "FOREIGN_DIR", "FOREIGN_PLAN_FILE", "isForeignMode", "hasForeignPlan",
  "planReadyForApproval", "ROLE_KEYS", "pickRole", "normRole", "isImplementer",
  "inPipeline", "writesGateMarker", "doneGreenTicketId", "parseTicketOutputs", "isOperatorApproval",
  "gateMarkerContent", "answerTextFromEvent", "toolCallSignature", "detectLoop",
]

for (const name of INLINED) {
  test(`drift: ${name} — плагин ≡ shared.mjs (исходник)`, () => {
    const s = decl(sharedSrc, name), p = decl(pluginSrc, name)
    assert.ok(s, `${name} не найден в shared.mjs`)
    assert.ok(p, `${name} не найден в плагине (инлайн потерян?)`)
    assert.equal(p, s, `${name} разошёлся между плагином и shared.mjs — синхронь инлайн`)
  })
}
