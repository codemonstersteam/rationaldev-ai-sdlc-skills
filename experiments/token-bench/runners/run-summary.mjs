#!/usr/bin/env node
// Сводка прогона харнеса: ПО КАЖДОМУ ШАГУ — какие скиллы реально загрузились
// субагенту (MUST-проверка «ровно нужные»), + токены/цена/время/вызовы.
//
//   node experiments/token-bench/runners/run-summary.mjs <logdir> [--repo <root>]
//
// Вход (артефакты прогона в <logdir>):
//   decisions.log — упорядоченные делегирования (ts \t role=<role> \t via \t title)
//   flow.jsonl    — полные тела запросов/ответов; во встроенных SKILL.md виден
//                   frontmatter `name: <skill>` → это и есть ФАКТ загрузки скилла,
//                   а роль запроса — по H1 системного промпта `# <role> —`.
//   usage.jsonl   — на запрос: input_tokens, completion_tokens, cost_usd, req_model, ts.
//
// Выход: (A) таблица шаг|агент(izi)|роль|модель|скиллы; (B) метрики по шагам + итоги.
// MUST: субагент не грузит скилл ВНЕ манифеста своей роли → иначе VIOLATION (exit 1).
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { parseFrontmatter } from "../../../harness/frontmatter.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const args = process.argv.slice(2)
const logdir = args.find((a) => !a.startsWith("--")) || "."
const repo = (() => { const i = args.indexOf("--repo"); return i >= 0 ? args[i + 1] : ROOT })()

// --- Манифесты: имена скиллов + карта роль→{skills, izi} ---
const INDEX = JSON.parse(readFileSync(join(repo, "skills", "INDEX.json"), "utf8"))
const SKILL_NAMES = INDEX.skills.map((s) => s.name)
const ROLE_SKILLS = new Map(INDEX.roles.map((r) => [r.role, new Set(r.skills)]))
const ROLES = INDEX.roles.map((r) => r.role)
const iziOf = (role) => {
  try { return parseFrontmatter(readFileSync(join(repo, "harness", "agents", "_shared", `${role}.md`), "utf8")).data?.izi || "—" }
  catch { return "—" }
}
const IZI = new Map(ROLES.map((r) => [r, iziOf(r)]))

// Детекторы: скилл загружен, если во встроенном SKILL.md есть frontmatter `name: <skill>`
// ЛИБО его H1 `# <skill>` (opencode иногда встраивает тело без frontmatter). Имена ролей и
// скиллов не пересекаются → H1 не путается. Роль запроса — по H1 промпта `# <role> —`.
// Без якоря `^|\n`: в flow тело — объект, JSON.stringify экранирует переводы строк.
const skillRe = new Map(SKILL_NAMES.map((s) => [s, new RegExp(`name:\\s*${s}\\b|#\\s+${s}(\\.skill)?\\b`)]))
// H1 роли бывает как полным (`# wirth-tester —`), так и коротким (`# moduledesigner —`).
const shortRole = (r) => r.replace(/^wirth-/, "")
const roleRe = new Map(ROLES.map((r) => [r, new RegExp(`#\\s+(?:${r}|${shortRole(r)})\\s+—`)]))

const readLines = (p) => readFileSync(join(logdir, p), "utf8").split("\n").filter(Boolean)
const asText = (b) => (typeof b === "string" ? b : JSON.stringify(b))

// --- decisions.log → шаги (только строки-делегирования `\trole=…`; ручные аннотации пропускаем) ---
const steps = readLines("decisions.log")
  .filter((l) => /\trole=/.test(l))
  .map((l, i) => {
    const [ts, roleTok, , ...rest] = l.split("\t")
    return { i: i + 1, ts: Date.parse(ts), role: roleTok.replace(/^role=/, ""), title: rest.join(" ") }
  })
if (!steps.length) { console.error(`нет шагов в ${logdir}/decisions.log`); process.exit(2) }

// --- flow.jsonl (dir=out) → {ts, matchedRole, skills, model} ---
const flow = []
for (const line of readLines("flow.jsonl")) {
  let d; try { d = JSON.parse(line) } catch { continue }
  if (d.dir !== "out") continue
  const s = asText(d.body)
  const matchedRole = ROLES.find((r) => roleRe.get(r).test(s)) || null
  const skills = SKILL_NAMES.filter((n) => skillRe.get(n).test(s))
  flow.push({ ts: Date.parse(d.ts), model: d.req_model, matchedRole, skills })
}

// --- usage.jsonl → {ts, in, out, cost, model} ---
const usage = readLines("usage.jsonl").map((l) => JSON.parse(l)).map((u) => ({
  ts: Date.parse(u.ts), in: u.input_tokens || 0, out: u.completion_tokens || 0,
  cost: u.cost_usd || 0, model: u.req_model || u.model || "—",
}))

// --- окна шагов: шаг i покрывает (ts_{i-1}, ts_i] ---
const lo = (i) => (i === 0 ? -Infinity : steps[i - 1].ts)
const inWin = (t, i) => t > lo(i) && t <= steps[i].ts
const uniq = (a) => [...new Set(a)]

const violations = []
const rows = steps.map((st, idx) => {
  // скиллы, реально загруженные ИМЕННО этой роли в окне шага
  const mine = flow.filter((f) => inWin(f.ts, idx) && f.matchedRole === st.role)
  const skills = uniq(mine.flatMap((f) => f.skills)).sort()
  const models = uniq(mine.map((f) => f.model).filter(Boolean))
  const u = usage.filter((x) => inWin(x.ts, idx))
  const allowed = ROLE_SKILLS.get(st.role)
  const extra = allowed ? skills.filter((s) => !allowed.has(s)) : []
  if (extra.length) violations.push({ step: st.i, role: st.role, extra })
  return {
    ...st, izi: IZI.get(st.role) || "—", skills, models,
    in: u.reduce((a, x) => a + x.in, 0), out: u.reduce((a, x) => a + x.out, 0),
    cost: u.reduce((a, x) => a + x.cost, 0), calls: u.length,
    dur: idx === 0 ? 0 : (steps[idx].ts - steps[idx - 1].ts) / 1000,
  }
})

// --- печать ---
const pad = (s, n) => String(s).padEnd(n)
const num = (n) => n.toLocaleString("en-US")
console.log(`\n# Сводка прогона — ${logdir}\n`)
console.log("## A. Скиллы по шагам (факт загрузки)\n")
console.log(pad("#", 3), pad("агент", 10), pad("роль", 20), pad("модель", 22), "скиллы (загружены)")
console.log("-".repeat(110))
for (const r of rows) {
  console.log(pad(r.i, 3), pad(r.izi, 10), pad(r.role, 20),
    pad(r.models.map((m) => m.split("/").pop()).join(",") || "—", 22),
    r.skills.join(", ") || "—")
}
console.log("\n## B. Метрики по шагам\n")
console.log(pad("#", 3), pad("роль", 20), pad("in", 10), pad("out", 8), pad("$", 10), pad("выз.", 5), "сек")
console.log("-".repeat(72))
for (const r of rows) {
  console.log(pad(r.i, 3), pad(r.role, 20), pad(num(r.in), 10), pad(num(r.out), 8),
    pad("$" + r.cost.toFixed(4), 10), pad(r.calls, 5), r.dur.toFixed(0))
}

// --- итоги ---
const T = { in: usage.reduce((a, x) => a + x.in, 0), out: usage.reduce((a, x) => a + x.out, 0), cost: usage.reduce((a, x) => a + x.cost, 0) }
const wall = (Math.max(...steps.map((s) => s.ts)) - Math.min(...steps.map((s) => s.ts))) / 1000
const byModel = {}
for (const u of usage) { const m = byModel[u.model] ||= { calls: 0, in: 0, out: 0, cost: 0 }; m.calls++; m.in += u.in; m.out += u.out; m.cost += u.cost }
console.log("\n## C. Итоги\n")
console.log(`шагов: ${steps.length} | вызовов: ${usage.length} | время: ${(wall / 60).toFixed(1)} мин`)
console.log(`токены: in ${num(T.in)} / out ${num(T.out)} | стоимость: $${T.cost.toFixed(4)}`)
console.log("по моделям:")
for (const [m, s] of Object.entries(byModel).sort((a, b) => b[1].cost - a[1].cost)) {
  console.log(`  ${pad(m, 26)} выз ${pad(s.calls, 4)} in ${pad(num(s.in), 11)} out ${pad(num(s.out), 8)} $${s.cost.toFixed(4)}`)
}

// --- MUST: никакой скилл вне манифеста роли ---
console.log("\n## D. MUST — скиллы ⊆ манифеста роли\n")
if (!violations.length) {
  console.log("✅ OK: на всех шагах субагенты грузили только скиллы своей роли.")
} else {
  for (const v of violations) console.log(`❌ шаг ${v.step} (${v.role}): загружены ВНЕ манифеста: ${v.extra.join(", ")}`)
  process.exitCode = 1
}
