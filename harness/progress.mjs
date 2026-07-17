#!/usr/bin/env node
// Детерминированный прогресс-бар конвейера. Читает ТОЛЬКО реальные артефакты (никакого LLM-рендера,
// который сгаллюцинирует зелёный тикет): .agent/decisions.log (роли + ticket=NN + action=|via=),
// docs/design/slice-*/tickets/*.md (заголовки), .agent/gates/*, .agent/planner/done.log.
// Запуск: node harness/progress.mjs [project-root]   (root по умолчанию — cwd).
// izi зовёт это по запросу оператора («прогресс/статус/где мы») и на вехах — вывод показывает verbatim.
import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

const root = process.argv[2] || process.cwd()
const rd = (p) => { try { return readFileSync(join(root, p), "utf8") } catch { return "" } }
const has = (p) => existsSync(join(root, p))

// --- decisions.log → статус ролей и тикетов -------------------------------------------------
const log = rd(".agent/decisions.log").split("\n").filter(Boolean)
const roleDone = new Set()   // роль имеет строку с action= → стадия завершена
const roleSeen = new Set()   // роль встречалась (via= или action=) → стартовала
const ticketDone = new Set() // ticket=ticket-NN в строке с action=
const ticketSeen = new Set()
for (const line of log) {
  const role = (line.match(/role=([a-z-]+)/) || [])[1]
  const isAction = /\taction=/.test(line)
  const tk = (line.match(/ticket=ticket-(\d+)/) || [])[1]
  if (role) { roleSeen.add(role); if (isAction) roleDone.add(role) }
  if (tk) { ticketSeen.add(tk); if (isAction) ticketDone.add(tk) }
  // free-text реализатора: "[scaffolder] ticket-01 … green" (scaffolder/hughes self-report)
  const fm = line.match(/ticket-(\d+)\b[^\n]*\bgreen\b/)
  if (fm) { ticketSeen.add(fm[1]); ticketDone.add(fm[1]) }
}
const lastRole = [...log].reverse().map((l) => (l.match(/role=([a-z-]+)/) || [])[1]).find(Boolean) || ""
const lastIsAction = /\taction=/.test([...log].reverse().find((l) => /role=/.test(l)) || "")

// --- слайс + тикеты -------------------------------------------------------------------------
let sliceDir = ""
if (has("docs/design")) {
  const d = readdirSync(join(root, "docs/design")).find((s) => has(`docs/design/${s}/tickets`))
  if (d) sliceDir = `docs/design/${d}`
}
const slice = sliceDir ? sliceDir.split("/").pop() : "—"
const tickets = []
if (sliceDir && has(`${sliceDir}/tickets`)) {
  for (const f of readdirSync(join(root, sliceDir, "tickets")).filter((n) => /^ticket-\d+\.md$/.test(n)).sort()) {
    const body = rd(`${sliceDir}/tickets/${f}`)
    const id = (body.match(/^id:\s*"?(\d+)/m) || [])[1] || f.match(/\d+/)[0]
    const type = (body.match(/^type:\s*(\S+)/m) || [])[1] || "?"
    const io = (body.match(/^io:\s*(\S+)/m) || [])[1] || ""
    const bb = (((body.match(/^blocked_by:\s*\[([^\]]*)\]/m) || [])[1] || "").match(/\d+/g) || [])
    const raw = ((body.match(/^###\s+TICKET\s+\S+\s+—\s+(.+)$/m) || [])[1] || "").replace(/`/g, "")
    const title = (raw.includes(":") ? raw.split(":")[0] : raw).trim().slice(0, 34) || type
    tickets.push({ id, type, io, title, bb })
  }
}
const done = has(".agent/planner/done.log")
  ? new Set((rd(".agent/planner/done.log").match(/ticket-(\d+)/g) || []).map((x) => x.slice(7)))
  : new Set()
// тикет зелёный, если он в done.log ИЛИ отмечен action=/green в логе (done.log в этом ране мог не наполниться)
const tkGreen = (id) => done.has(id) || ticketDone.has(id)
// via=-строки не несут ticket= → in-flight выводим DAG-инференсом: следующий незелёный тикет с зелёными
// blocked_by, ЕСЛИ реализатор сейчас в полёте (последняя роль — реализатор без action=).
const implInFlight = ["scaffolder", "hughes", "hughes-rework", "wirth-tester", "linger"].includes(lastRole) && !lastIsAction
const nextTk = tickets.find((t) => !tkGreen(t.id) && (t.bb || []).every((b) => tkGreen(b)))
const tkRun = (id) => implInFlight && nextTk && nextTk.id === id

// --- гейты ----------------------------------------------------------------------------------
const gate1 = has(".agent/gates/gate1.approved")
const gate2 = has(".agent/gates/gate2.approved") || has(".agent/gates/gate2.accepted")
const target = rd(".agent/planner/target").trim() || "service"

// --- рендер ----------------------------------------------------------------------------------
const bar = (pct, w = 44) => "█".repeat(Math.round((pct / 100) * w)) + "░".repeat(w - Math.round((pct / 100) * w))
const mark = (b) => (b ? "✅" : "⬜")
const line = "═".repeat(76)

const DESIGN = [
  ["gilb", "BRD / requirements-intake"],
  ["wirth-triage", "triage → level"],
  ["wirth-slicer", "vertical slices"],
  ["wirth-usecase", "Cockburn use-case"],
  ["wirth-apidesigner", `frozen contract (${target} profile)`],
  ["wirth-moduledesigner", "module tree + C4 + contracts"],
  ["dijkstra", "README (Procedure A)"],
  ["wirth-ticketer", "tickets cut"],
  ["mills", "plan-review"],
  ["wirth-planner", "PLAN.md assembled"],
]
const dDone = DESIGN.filter(([r]) => roleDone.has(r)).length + (gate1 ? 1 : 0)
const dTotal = DESIGN.length + 1 // + Gate #1
const dPct = Math.round((dDone / dTotal) * 100)

const nTk = tickets.length || 10
const tkGreenN = tickets.filter((t) => tkGreen(t.id)).length
const iPct = nTk ? Math.round((tkGreenN / nTk) * 100) : 0

const faganDone = roleDone.has("fagan")
const aDone = (roleDone.has("fagan") ? 1 : 0) + (gate2 ? 1 : 0)
const aPct = Math.round((aDone / 2) * 100)

const overall = Math.round(dPct * 0.45 + iPct * 0.45 + aPct * 0.1)

const out = []
out.push(`PINOUT · ${slice} · target=${target}`)
out.push(line)
out.push("")
out.push(`DESIGN & PLANNING  ${bar(dPct)}  ${String(dPct).padStart(3)}%  ${dPct === 100 ? "✅" : "🔄"}`)
for (const [r, label] of DESIGN) out.push(`  ${mark(roleDone.has(r))} ${label.padEnd(34)} (${r})`)
out.push(`  ${gate1 ? "✅" : "⬜"} ═══ GATE #1 ${gate1 ? "ACCEPTED" : "pending"} ═══════════════ 🚦 ${gate1 ? "passed" : "waiting operator"}`)
out.push("")
out.push(`IMPLEMENTATION     ${bar(iPct)}  ${String(iPct).padStart(3)}%  ${iPct === 100 ? "✅" : gate1 ? "🔄" : "⬜"}`)
for (const t of tickets) {
  const s = tkGreen(t.id) ? "✅" : tkRun(t.id) ? "🔄" : "⬜"
  const suf = tkGreen(t.id) ? "green" : tkRun(t.id) ? "← running now" : ""
  out.push(`  ${s} T${t.id}  ${(t.title || t.type).padEnd(34)} ${(t.io ? "io:" + t.io : "").padEnd(9)} ${suf}`)
}
out.push("")
out.push(`ACCEPTANCE         ${bar(aPct)}  ${String(aPct).padStart(3)}%  ${aPct === 100 ? "✅" : "⬜"}`)
out.push(`  ${mark(roleSeen.has("linger"))} fixer / CI (if needed)              (linger)`)
out.push(`  ${mark(faganDone)} Fagan slice-acceptance → strip @wip (fagan)`)
out.push(`  ${gate2 ? "✅" : "⬜"} ═══ GATE #2 ${gate2 ? "MERGED" : "pending"} ═══════════════════ 🚦 ${gate2 ? "done" : "pending"}`)
out.push("")
out.push("─".repeat(76))
out.push(`Overall:  ${bar(overall, 40)}  ~${overall}%`)
out.push(`Tickets:  ${tkGreenN} / ${nTk} done · ${tickets.filter((t) => tkRun(t.id)).length} in progress`)
const next = !gate1 ? "🚦 GATE #1 (plan acceptance)" : iPct < 100 ? "auto-run (hughes drives modules by DAG) → then Gate #2" : !gate2 ? "🚦 GATE #2 (merge) — after fixer + Fagan" : "done ✅"
out.push(`Next stop for you:  ${next}`)
console.log(out.join("\n"))
