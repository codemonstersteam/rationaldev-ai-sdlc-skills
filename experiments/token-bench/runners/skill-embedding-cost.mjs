#!/usr/bin/env node
// Оценка «потолка экономии» от перехода скиллов на модель skill-as-tool (#40):
// сколько input-токенов прогона приходится на ВСТРОЕННЫЕ в контекст тела SKILL.md.
// Сейчас тело скилла пересылается в КАЖДОМ запросе цикла субагента; с skill-as-tool
// оно грузится ~один раз на (роль, скилл). Разница = экономия (net-потолок).
//
//   node experiments/token-bench/runners/skill-embedding-cost.mjs <logdir> [--repo <root>] [--md]
//
// --md → печатает markdown-таблицу (для сохранения в бенч). Оценка токенов груба
// (chars/4), поэтому это ВЕРХНЯЯ ГРАНИЦА, не точный счёт.
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const argv = process.argv.slice(2)
const logdir = argv.find((a) => !a.startsWith("--")) || "."
const repo = (() => { const i = argv.indexOf("--repo"); return i >= 0 ? argv[i + 1] : ROOT })()
const asMd = argv.includes("--md")

const INDEX = JSON.parse(readFileSync(join(repo, "skills", "INDEX.json"), "utf8"))
const ROLES = INDEX.roles.map((r) => r.role)
const estTok = (s) => Math.ceil(s.length / 4) // груб. оценка токенов

// размер тела каждого скилла (по пути из INDEX.path) → оценка токенов
const SKILL = new Map()
for (const s of INDEX.skills) {
  let tok = 0
  try { tok = estTok(readFileSync(join(repo, s.path), "utf8")) } catch { tok = 0 }
  SKILL.set(s.name, tok)
}
const skillRe = new Map([...SKILL.keys()].map((s) => [s, new RegExp(`name:\\s*${s}\\b|#\\s+${s}(\\.skill)?\\b`)]))
const shortRole = (r) => r.replace(/^wirth-/, "")
const roleRe = new Map(ROLES.map((r) => [r, new RegExp(`#\\s+(?:${r}|${shortRole(r)})\\s+—`)]))

const lines = readFileSync(join(logdir, "flow.jsonl"), "utf8").split("\n").filter(Boolean)
// per (role, skill): в скольких запросах встроен
const rs = new Map() // key `${role}|${skill}` → count
const perSkill = new Map() // skill → { embeds, roles:Set }
for (const line of lines) {
  let d; try { d = JSON.parse(line) } catch { continue }
  if (d.dir !== "out") continue
  const s = typeof d.body === "string" ? d.body : JSON.stringify(d.body)
  const role = ROLES.find((r) => roleRe.get(r).test(s)) || "izi?"
  for (const [name, re] of skillRe) {
    if (!re.test(s)) continue
    rs.set(`${role}|${name}`, (rs.get(`${role}|${name}`) || 0) + 1)
    const ps = perSkill.get(name) || { embeds: 0, roles: new Set() }
    ps.embeds++; ps.roles.add(role); perSkill.set(name, ps)
  }
}

// суммы
let grossTok = 0, netTok = 0
const rows = [...perSkill.entries()].map(([name, ps]) => {
  const tok = SKILL.get(name) || 0
  const gross = ps.embeds * tok
  // net-экономия: тело грузится ~1 раз на (роль,скилл), значит экономим (embeds-1) на пару
  let net = 0
  for (const [k, cnt] of rs) if (k.endsWith(`|${name}`)) net += Math.max(0, cnt - 1) * tok
  grossTok += gross; netTok += net
  return { name, tok, embeds: ps.embeds, roles: ps.roles.size, gross, net }
}).sort((a, b) => b.net - a.net)

// total input из usage.jsonl
let totalIn = 0, totalCost = 0
try {
  for (const l of readFileSync(join(logdir, "usage.jsonl"), "utf8").split("\n").filter(Boolean)) {
    const u = JSON.parse(l); totalIn += u.input_tokens || 0; totalCost += u.cost_usd || 0
  }
} catch {}
const pct = (n) => (totalIn ? ((n / totalIn) * 100).toFixed(1) + "%" : "—")
const num = (n) => n.toLocaleString("en-US")

if (asMd) {
  const P = []
  P.push(`# Baseline: стоимость встраивания скиллов (потолок экономии #40)`)
  P.push("")
  P.push(`Источник: \`${logdir}\`. Оценка токенов груба (chars/4) → **верхняя граница**.`)
  P.push(`Тело скилла пересылается в каждом запросе цикла роли; skill-as-tool грузит его ~1 раз на (роль,скилл).`)
  P.push("")
  P.push(`- **Всего input-токенов прогона:** ${num(totalIn)} (стоимость $${totalCost.toFixed(4)})`)
  P.push(`- **Встроено скиллами (gross):** ~${num(grossTok)} (${pct(grossTok)} input)`)
  P.push(`- **Потолок экономии (net, повторные пересылки):** ~${num(netTok)} (${pct(netTok)} input)`)
  P.push("")
  P.push(`| скилл | ток/шт | встроен (запросов) | ролей | gross ток | net-экономия |`)
  P.push(`|---|--:|--:|--:|--:|--:|`)
  for (const r of rows) P.push(`| ${r.name} | ${num(r.tok)} | ${r.embeds} | ${r.roles} | ${num(r.gross)} | ${num(r.net)} |`)
  P.push(`| **Σ** | | | | **${num(grossTok)}** | **${num(netTok)}** |`)
  P.push("")
  P.push(`> Замер after-#40: тот же скрипт на новом прогоне; ожидаем net→~0 (тела не встраиваются).`)
  console.log(P.join("\n"))
} else {
  console.log(`input total: ${num(totalIn)} | встроено скиллами ~${num(grossTok)} (${pct(grossTok)}) | net-потолок ~${num(netTok)} (${pct(netTok)})`)
  for (const r of rows) console.log(`  ${r.name.padEnd(28)} ток ${String(r.tok).padStart(5)} × ${String(r.embeds).padStart(3)} → gross ${num(r.gross)} / net ${num(r.net)}`)
}
