#!/usr/bin/env node
// close-run — closes a finished patch run AFTER Gate #2 (the operator's merge accept).
// Three acts in a FIXED order, each verified before the next: tag → ledger → wipe.
// Deterministic, zero judgement — this is why it is a script, not an LLM step (@ledger just invokes it).
//
// Discipline (in → out → verify):
//   guard : .agent/gates/gate2.approved present · work branch merged into trunk        else STOP
//   1 tag : weight←.agent/planner/mode · title/files←forge · tags←`git ls-remote origin`
//           → ci/semver-bump.mjs decides · git tag+push on trunk merge-sha · verify on the FORGE
//   2 led : append a self-sufficient entry → docs/changes/LEDGER.md · verify grep hits
//   3 wipe: rm .agent run-state (keep decisions.log) · verify .agent/gates empty
//   Order is causal: 1 and 2 READ what 3 erases, so wipe is last.
//
// Usage: node harness/close-run.mjs --pr <N> [--repo <dir>] [--json]
// Exit 0 = closed (tag may be null — plumbing no-bump is normal). Exit 2 = STOP (guard failed / act failed).

import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync, existsSync, rmSync, appendFileSync, mkdirSync, readlinkSync, lstatSync } from "node:fs"
import { join, dirname } from "node:path"

// ── pure core (io injected → unit-testable without git/forge) ────────────────────

// The trunk tag decision NEVER lives here — it is delegated to semver-bump so the no-bump rule and
// the repo's tag form stay in ONE place. This core only orchestrates order + verification.
export function planClose({ gate2, merged, weight, prTitle, files, tags, bump }) {
  if (!gate2) return { stop: "Gate #2 not approved — .agent/gates/gate2.approved absent" }
  if (!merged) return { stop: "work branch not merged into trunk — nothing to close" }
  if (!weight) return { stop: ".agent/planner/mode empty — weight unknown" }
  const { tag, reason } = bump({ weight, title: prTitle, files, tags })
  return { stop: null, tag, reason }
}

// Where the ledger entry text comes from — self-sufficient by construction (survives change-dir retention).
export function ledgerEntry({ ts, slug, weight, pr, mergeSha, tag, reason, task }) {
  return [
    `## ${ts} — ${slug}`,
    `- weight: ${weight}`,
    `- PR: ${pr}`,
    `- merge: ${mergeSha}`,
    `- tag: ${tag || `no-bump: ${reason}`}`,
    `- task: ${(task || "").replace(/\s+/g, " ").trim().slice(0, 200)}`,
    "",
  ].join("\n")
}

// Run-state to erase (keep decisions.log — that is the trace, not state).
export const WIPE = [".agent/gates", ".agent/planner/mode", ".agent/planner/change-dir",
  ".agent/planner/chore-dir", ".agent/planner/brd.md", ".agent/planner/done.log", ".agent/vcs"]

// ── side-effecting shell (only reached via CLI) ──────────────────────────────────
const isMain = process.argv[1] && process.argv[1].endsWith("close-run.mjs")
if (isMain) {
  const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d }
  const has = (n) => process.argv.includes(n)
  const ROOT = arg("--repo", process.cwd())
  const PR = arg("--pr")
  const R = (f, ...a) => execFileSync(f, a, { cwd: ROOT, encoding: "utf8" }).trim()
  const Rq = (f, ...a) => { try { return R(f, ...a) } catch { return "" } }
  const stop = (m) => { console.error(`STOP: ${m}`); if (has("--json")) console.log(JSON.stringify({ closed: false, stop: m })); process.exit(2) }
  const read = (rel) => { try { return readFileSync(join(ROOT, rel), "utf8") } catch { return "" } }

  if (!PR) stop("--pr <N> required")

  // resolve the tool: harness/ is a symlink to <clone>/harness; ci/ sits NEXT to harness in the clone.
  // NOT ci/ in the target repo, NOT harness/ci/ — neither exists. Resolve through the symlink target.
  let bumpPath = ""
  try {
    const hs = join(ROOT, "harness")
    const clone = lstatSync(hs).isSymbolicLink() ? readlinkSync(hs) : hs
    bumpPath = join(dirname(clone), "ci", "semver-bump.mjs")
  } catch { /* fall through to guard */ }
  if (!bumpPath || !existsSync(bumpPath)) stop(`semver-bump.mjs not found (looked at ${bumpPath || "<unresolved>"})`)

  // trunk = repo default branch
  const trunk = Rq("git", "symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD").replace(/^origin\//, "") || "main"
  Rq("git", "fetch", "--quiet", "origin", trunk, "--tags")

  // guards
  const gate2 = existsSync(join(ROOT, ".agent/gates/gate2.approved"))
  // "merged" = the WORK is in trunk, not "the branch still exists in the merged list". A PR merged with
  // branch-delete leaves no branch — that is merged-and-cleaned, not un-merged. Check the branch's tip is
  // an ancestor of trunk; if the branch is gone (deleted on merge) or absent, treat as merged.
  const branch = read(".agent/vcs/branch").trim()
  const tip = branch ? Rq("git", "rev-parse", "--verify", "--quiet", branch) : ""   // "" = no branch (deleted on merge)
  // merged iff the branch tip is an ancestor of trunk; no branch → merged-and-cleaned → true.
  // Это лишь ЗАПАСНОЙ признак: авторитетный пруф даёт форж (ниже), т.к. squash/rebase-мерж
  // ancestor-связь не оставляет.
  let merged = true
  if (tip) { try { R("git", "merge-base", "--is-ancestor", branch, `origin/${trunk}`); merged = true } catch { merged = false } }
  // defensive: срезаем BOM и случайный префикс `weight=` (триаж иногда копирует его из return-строки)
  const weight = read(".agent/planner/mode").replace(/^﻿/, "").trim().replace(/^weight[=:]\s*/i, "")

  if (!gate2) stop("Gate #2 not approved — .agent/gates/gate2.approved absent")
  if (!weight) stop(".agent/planner/mode empty — weight unknown")

  // ACT 1 — tag (decision delegated to semver-bump). PR title+files read via the ACTIVE forge:
  //   gh → `gh pr view` (title+files in one call). Provider from `.agent/planner/vcs`, else the `default`
  // in harness/vcs-providers.json — the only wired provider is `gh`; anything else STOPs (never guess a
  // forge). Tags come from git below (`ls-remote`) — forge-agnostic.
  const provider = read(".agent/planner/vcs").trim() || registryDefault(ROOT) || "gh"
  if (provider !== "gh") stop(`vcs provider '${provider}' not wired for close-run (only 'gh' reads PR meta)`)
  let meta
  try {
    meta = prMetaGh(PR, forgeRepo(ROOT, Rq), Rq)
  } catch (e) { stop(`pr_meta(${provider}) failed: ${String((e && e.message) || e).slice(0, 200)}`) }
  // ПРУФ МЕРДЖА (акт 0): форж авторитетен — он знает про squash/rebase; git-ancestor остаётся запасным.
  if (meta.merged === false) stop(`PR #${PR} not merged on the forge — nothing to close`)
  if (meta.merged === null && !merged) stop(`work branch '${branch}' not merged into ${trunk}`)
  writeFileSync("/tmp/cr-title.txt", meta.title || "")
  writeFileSync("/tmp/cr-files.txt", (meta.files || []).join("\n"))
  // tags from the FORGE, not `git tag --list` (local lags behind what CI/other humans pushed)
  const tags = Rq("git", "ls-remote", "--tags", "origin").split("\n")
    .map((l) => l.split("/").pop()).filter((t) => t && !t.endsWith("^{}")).join("\n")
  writeFileSync("/tmp/cr-tags.txt", tags)

  const bumpOut = JSON.parse(R("node", bumpPath, "--weight", weight,
    "--pr-title", "/tmp/cr-title.txt", "--files-from", "/tmp/cr-files.txt", "--tags-from", "/tmp/cr-tags.txt", "--json"))
  const { tag, reason } = bumpOut
  const mergeSha = Rq("git", "rev-parse", `origin/${trunk}`)

  if (tag) {
    const exists = Rq("git", "ls-remote", "--tags", "origin", `refs/tags/${tag}`)
    if (exists) { /* keep — never overwrite version history */ }
    else {
      R("git", "tag", "-a", tag, "-m", `${tag} — ${reason} (PR #${PR})`, mergeSha)
      R("git", "push", "origin", tag)
      const onForge = Rq("git", "ls-remote", "--tags", "origin", `refs/tags/${tag}`)
      if (!onForge) stop(`tag ${tag} push did not land on the forge (branch/tag protection? token scope?)`)
    }
  }

  // ACT 2 — ledger (after the tag is real)
  const slug = branch.replace(/^[a-z]+\//, "") || PR
  const led = join(ROOT, "docs/changes/LEDGER.md")
  if (!existsSync(led)) { mkdirSync(dirname(led), { recursive: true }); writeFileSync(led, "# LEDGER — closed runs\n\n") }
  appendFileSync(led, ledgerEntry({ ts: new Date().toISOString(), slug, weight,
    pr: prUrl(ROOT, PR, provider, Rq), mergeSha, tag, reason, task: read(".agent/planner/brd.md").split("\n").find((l) => l.trim() && !l.startsWith("#")) || slug }))
  if (!readFileSync(led, "utf8").includes(slug)) stop("ledger entry not written")

  // Запись обязана быть ДОЛГОВЕЧНОЙ: файл в рабочем дереве — не запись, а черновик. Он исчезнет при
  // свежем клоне и, что хуже, будет подметён `git add -A` следующего прогона в чужой PR. Поэтому
  // коммит плумбинга прямо в транк (диффа продукта нет ⇒ no-bump, канарейку не гонит).
  let ledgerPushed = false
  try {
    R("git", "add", "docs/changes/LEDGER.md")
    R("git", "commit", "-m", `chore(ledger): закрыт прогон ${slug} (PR #${PR}${tag ? `, ${tag}` : ", no-bump"})`)
    R("git", "push", "origin", `HEAD:${trunk}`)
    ledgerPushed = true
  } catch (e) {
    // Защита транка / отсутствие прав — не повод рушить закрытие: тег уже стоит, запись есть локально.
    console.error(`WARN: ledger commit/push failed (${String((e && e.message) || e).slice(0, 120)}) — запись осталась в рабочем дереве`)
  }

  // ACT 3 — wipe (last: acts 1–2 read what this erases)
  for (const p of WIPE) rmSync(join(ROOT, p), { recursive: true, force: true })
  if (existsSync(join(ROOT, ".agent/gates"))) stop("run-state wipe incomplete")

  const out = { closed: true, tag: tag || null, reason, ledger: "docs/changes/LEDGER.md", ledgerPushed, wiped: true, slug }
  if (has("--json")) console.log(JSON.stringify(out))
  else console.log(`ledger → closed ${slug}: tag=${tag || `no-bump (${reason})`}, ledger ${ledgerPushed ? "committed to trunk" : "written (NOT pushed)"}, run-state wiped`)
  process.exit(0)
}

function forgeRepo(root, Rq) {
  const url = Rq("git", "-C", root, "remote", "get-url", "origin")
  const m = /[:/]([^/:]+\/[^/]+?)(?:\.git)?$/.exec(url)
  return m ? m[1] : ""
}
function prUrl(root, pr, _provider, Rq) {
  const repo = forgeRepo(root, Rq)        // "owner/repo"
  return repo ? `https://github.com/${repo}/pull/${pr}` : `PR #${pr}`
}

// Active-forge default when no `.agent/planner/vcs` marker: read it from the registry through the symlink
// (harness/ → <clone>/harness; vcs-providers.json sits in the clone's harness). Missing → gh.
function registryDefault(root) {
  try {
    const hs = join(root, "harness")
    const clone = lstatSync(hs).isSymbolicLink() ? readlinkSync(hs) : hs
    return JSON.parse(readFileSync(join(clone, "vcs-providers.json"), "utf8")).default || "gh"
  } catch { return "gh" }
}

// ── PR metadata per forge (title + changed-file paths) ───────────────────────────
function prMetaGh(pr, repo, Rq) {
  const title = Rq("gh", "pr", "view", pr, "--repo", repo, "--json", "title", "--jq", ".title")
  const files = Rq("gh", "pr", "view", pr, "--repo", repo, "--json", "files", "--jq", ".files[].path")
    .split("\n").map((s) => s.trim()).filter(Boolean)
  // Пруф мерджа — у ФОРЖА, а не у графа коммитов: squash/rebase-мерж переписывает коммиты, и ветка
  // ancestor'ом транка не становится, хотя работа влита. state=="" (форж недоступен) → null, решает git.
  const state = Rq("gh", "pr", "view", pr, "--repo", repo, "--json", "state", "--jq", ".state")
  return { title, files, merged: state ? state === "MERGED" : null }
}
