#!/usr/bin/env node
// ledger — журнал закрытых прогонов, СОБРАННЫЙ ИЗ GIT. Файла `docs/changes/LEDGER.md` больше нет:
// коммитить журнал значило платить лишним коммитом в транк за каждый прогон (и ловить non-fast-forward,
// когда HEAD после мержа стоит на рабочей ветке). Запись живёт тремя слоями, каждый пишет тот, кто
// владеет фактом, и тогда, когда факт известен:
//   1. мерж-коммит (он же анкер тега) — PR, slug, дата, вес из Conventional-заголовка;
//   2. трейлеры коммита рабочей ветки (`@git-hand` на commit_push) — Run/Weight/BR/Task, неизменяемы;
//   3. git-заметка refs/notes/ledger на merge-SHA (`@ledger` после мержа) — tag/bump/reason/released,
//      то есть ровно то, чего коммит нести не может: тег считается ПОСЛЕ мержа.
// Приоритет на чтении: трейлер → заметка → мерж-коммит. Нет слоя — запись деградирует, но не пропадает.
//
// Usage: node harness/ledger.mjs [--md|--json] [--limit N] [--since <ref>] [--repo <dir>] [--no-fetch]
// Exit 0 всегда — пустой журнал это штатный исход, а не сбой.

import { execFileSync } from "node:child_process"

// ── pure core (io injected → unit-testable without git) ──────────────────────────

// Трейлеры git-футера (`Key: value` в конце сообщения). Последний выигрывает: amend/повторный коммит
// дописывает свой футер ниже, и он же актуален. Регистр ключа нормализуем, значение — как есть.
export function trailersFrom(text) {
  const out = {}
  for (const m of String(text ?? "").matchAll(/^[ \t]*([A-Za-z][A-Za-z0-9_-]*):[ \t]*(.+?)[ \t]*$/gm)) {
    out[m[1].toLowerCase()] = m[2]
  }
  return out
}

// Номер PR: мерж-коммит форжа («Merge pull request #8 from …») или squash-заголовок («… (#8)»).
export function prNumberFrom(subject) {
  const m = /Merge pull request #(\d+)/i.exec(String(subject ?? "")) || /\(#(\d+)\)\s*$/.exec(String(subject ?? ""))
  return m ? m[1] : null
}

// Slug прогона из subject мержа: `Merge pull request #8 from <owner>/<type>/<slug>` → `<slug>`.
// Владелец и тип-префикс ветки отбрасываются; ветка без префикса отдаёт себя целиком.
export function slugFromSubject(subject) {
  const m = /Merge pull request #\d+ from \S+?\/(\S+)/i.exec(String(subject ?? ""))
  if (!m) return null
  const parts = m[1].split("/")
  return parts.length > 1 ? parts.slice(1).join("/") : parts[0]
}

// Одна запись журнала из трёх слоёв. `weightFrom` инжектится (реализация — ci/semver-bump.mjs), чтобы
// правило «Conventional-заголовок → вес» жило в ОДНОМ месте. Слоя нет → поле пустое, а не выдумано.
export function entryFrom({ sha, date, subject, body, trailers = {}, note = {} }, { weightFrom } = {}) {
  const weight = trailers.weight
    || (weightFrom ? weightFrom({ title: body || "", body: "" }) || weightFrom({ title: subject || "", body: "" }) : null)
    || note.weight || null
  return {
    sha,
    date: note.closed_at || date,
    pr: prNumberFrom(subject),
    run: trailers.run || note.run || slugFromSubject(subject) || null,
    weight,
    task: trailers.task || note.task || null,
    br: trailers.br && trailers.br !== "—" ? trailers.br : null,
    tag: note.tag && note.tag !== "none" ? note.tag : null,
    bump: note.bump || null,
    reason: note.reason || null,
    released: note.released || null,
  }
}

// Прогон — это ЗАКРЫТАЯ работа: мерж PR, трейлер `Run:` или заметка. Один лишь вес не признак: под него
// подходит каждый второй коммит транка (`feat(x): …`), и журнал превратился бы в git log.
export function isRunEntry(e) {
  return Boolean(e.pr || e.run || e.tag || e.bump)
}

export function renderMd(entries) {
  if (!entries.length) return "# LEDGER — closed runs\n\n_(записей нет)_\n"
  const out = ["# LEDGER — closed runs", ""]
  for (const e of entries) {
    out.push(`## ${e.date} — ${e.run || e.sha.slice(0, 12)}`)
    out.push(`- weight: ${e.weight || "—"}`)
    if (e.pr) out.push(`- PR: #${e.pr}`)
    out.push(`- merge: ${e.sha}`)
    // Заметки нет ⇒ исход тега НЕИЗВЕСТЕН (прогон закрыт до перехода на заметки, либо push не лёг).
    // Печатать здесь «no-bump» значило бы выдумать факт.
    out.push(`- tag: ${e.tag || (e.bump === "no-bump" ? `no-bump${e.reason ? `: ${e.reason}` : ""}` : "—")}`)
    if (e.br) out.push(`- BR: ${e.br}`)
    if (e.released) out.push(`- released: ${e.released}`)
    if (e.task) out.push(`- task: ${e.task}`)
    out.push("")
  }
  return out.join("\n")
}

// ── CLI (побочки здесь; всё выше — чистое) ───────────────────────────────────────
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())
if (isMain) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : undefined }
  const has = (n) => process.argv.includes(n)
  const ROOT = arg("--repo") || process.cwd()
  const g = (...a) => { try { return execFileSync("git", ["-C", ROOT, ...a], { encoding: "utf8" }).trim() } catch { return "" } }

  if (has("--help")) {
    console.log([
      "harness/ledger.mjs — журнал закрытых прогонов, собранный из git (файла LEDGER.md нет).",
      "",
      "  node harness/ledger.mjs                 # markdown в stdout",
      "  node harness/ledger.mjs --json          # массив записей",
      "  node harness/ledger.mjs --limit 20      # сколько коммитов транка просмотреть (по умолчанию 100)",
      "  node harness/ledger.mjs --since v1.2.0  # только после этого ref",
      "  node harness/ledger.mjs --no-fetch      # не тянуть refs/notes/* с origin",
    ].join("\n"))
    process.exit(0)
  }

  // Заметки не ходят с обычным fetch — тянем их явно, best-effort (нет сети/прав → журнал из локального).
  if (!has("--no-fetch")) g("fetch", "--quiet", "origin", "refs/notes/*:refs/notes/*")

  const trunk = g("symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD").replace(/^origin\//, "") || "main"
  const range = arg("--since") ? `${arg("--since")}..origin/${trunk}` : `origin/${trunk}`
  const US = "\x1f", RS = "\x1e"
  const raw = g("log", `--max-count=${arg("--limit") || 100}`, "--notes=ledger",
    `--format=%H${US}%cI${US}%s${US}%b${US}%N${RS}`, range)

  // Вес из Conventional-заголовка — общий модуль, а не своя копия правила. ci/ лежит РЯДОМ с harness/
  // в клоне харнеса (в целевом репо harness — симлинк), поэтому резолвим от этого файла.
  let weightFrom = null
  try { ({ weightFrom } = await import(new URL("../ci/semver-bump.mjs", import.meta.url).href)) } catch { /* деградация: вес только из трейлера/заметки */ }

  const entries = []
  for (const rec of raw.split(RS).map((r) => r.replace(/^\n/, "")).filter((r) => r.trim())) {
    const [sha, date, subject, body, noteText] = rec.split(US)
    // Трейлеры мерж-коммита живут в коммитах ВЛИТОЙ ветки (`<merge>^1..<merge>^2`), а не в самом мерже.
    const parents = g("rev-list", "--parents", "-n", "1", sha).split(" ").slice(1)
    const branchMsgs = parents.length > 1 ? g("log", "--format=%B", `${sha}^1..${sha}^2`) : ""
    const e = entryFrom({
      sha, date, subject, body,
      trailers: trailersFrom(`${branchMsgs}\n${body || ""}`),
      note: trailersFrom(noteText || ""),
    }, { weightFrom })
    if (isRunEntry(e)) entries.push(e)
  }

  if (has("--json")) console.log(JSON.stringify(entries, null, 2))
  else console.log(renderMd(entries))
  process.exit(0)
}
