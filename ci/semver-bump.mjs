#!/usr/bin/env node
// E6 — тег-автоматика транка. Источник правды версии — git-тег (без VERSION-файла: нечему разъезжаться).
// Форма тега (`1.2.3` или `v1.2.3`) — ПО РЕПО: берётся у последнего релизного тега.
//
// Контур: @git-hand протаскивает `weight` в PR (сам НЕ бампает) → мерж в транк → CI зовёт этот модуль →
// тег ставится автоматикой. Человек акцептует мерж на Gate #2; тег — механика, не суждение.
//
// Ядро ниже — ЧИСТОЕ (io: none), поэтому тестируется без git/CI. Побочки (чтение тегов, diff, push)
// живут в CLI-хвосте и в .github/workflows/tag-on-merge.yml.
//
// Запуск: node ci/semver-bump.mjs --weight patch --files-from <file> [--tags-from <file>] [--json]
//         node ci/semver-bump.mjs --pr-title <file> [--pr-body <file>] --files-from <file> --tags-from <file>
//         node ci/semver-bump.mjs --weight patch --from-git        (теги и diff берёт из git сам)

import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

// SemVer-тег с НЕОБЯЗАТЕЛЬНЫМ префиксом `v`. Pre-release/build — расширения формата, вес НЕ меняют.
//
// Фиксировано ПОНЯТИЕ «тег транка авторитетен», а ФОРМА (`1.2.3` / `v1.2.3`) берётся у последнего
// релизного тега репо: жёсткое требование голого `1.2.3` заставляло не видеть живые `v`-теги и сеять
// параллельную нумерацию с нуля.
const TAG_RE = /^(v?)(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/

export function parseTag(tag) {
  const m = TAG_RE.exec(String(tag || "").trim())
  if (!m) return null
  return { prefix: m[1], major: +m[2], minor: +m[3], patch: +m[4], pre: m[5] ?? null, build: m[6] ?? null }
}

// Последний РЕЛИЗНЫЙ тег. Pre-release (канарейки) игнорируем — канарейка не двигает базу версии.
export function latestRelease(tags) {
  const rel = (tags || []).map(parseTag).filter((t) => t && !t.pre)
  if (!rel.length) return null
  return rel.sort((a, b) => a.major - b.major || a.minor - b.minor || a.patch - b.patch).at(-1)
}

// ── no-bump по diff ──
// Решение оператора (E1): chore схлопнут в patch, но изменение, НЕ трогающее продуктовый код и контракт,
// версию не двигает и канарейку не гонит. Классификация ушла из суждения триажа в проверяемый по факту
// автомат: не «агент решил, что это плумбинг», а «в diff'е нет ни одного продуктового файла».
//
// Денилист: путь — плумбинг, только если ЗАВЕДОМО им является. Всё неизвестное → продуктовое.
// FAIL-CLOSED сознательно: лишний патч-тег дёшев, потерянная версия продуктового изменения — нет.
export const PLUMBING = [
  /^\.github\//, /^\.gitlab-ci\.yml$/, /^\.gitignore$/, /^\.gitattributes$/,
  /^\.editorconfig$/, /^\.dockerignore$/,
  /(^|\/)Dockerfile(\.[\w-]+)?$/, /(^|\/)docker-compose(\.[\w-]+)?\.ya?ml$/,
  /(^|\/)Makefile$/,
  /\.md$/, /^docs\//, /^LICENSE$/,
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|go\.sum|Cargo\.lock|poetry\.lock)$/,
  /(^|\/)\.?(eslintrc|prettierrc|ruff|flake8)(\.(json|ya?ml|toml|js|cjs))?$/,
]

export const isPlumbing = (path) => PLUMBING.some((re) => re.test(String(path)))
export const touchesProduct = (files) => (files || []).some((f) => f && !isPlumbing(f))

// Вес из ЗАГОЛОВКА PR по Conventional Commits — единственный источник (одно место, расходиться нечему).
//   fix: …            → patch
//   feat: …           → minor
//   <type>!: …        → major   (восклицательный знак ПОБЕЖДАЕТ тип: `fix!:` это major, не patch)
//   BREAKING CHANGE:  → major   (в теле, футером — второй канонический маркер прорыва)
//
// ВАЖНО: заголовок — это ЗАПИСЬ веса, посчитанного `@wirth-triage`, а НЕ самостоятельное суждение.
// `@git-hand` выводит префикс из `.agent/planner/mode` и ничего не выбирает сам. Иначе вернулась бы
// путаница, которую убрал E1: тип коммита — про РОД изменения, вес — про СОВМЕСТИМОСТЬ. Багфикс,
// ломающий совместимость, это `fix!:` (major), и решает это триаж, а не автор коммита.
//
// Читаем именно заголовок PR, а не subject мержа: при squash форж берёт заголовок PR, при
// merge-commit subject выглядит как «Merge pull request #N …» и веса не несёт.
const CC_HEADER = /^\s*(?<type>[a-z]+)(?:\([^)]*\))?(?<bang>!)?:\s*\S/i

export function weightFrom({ title = "", body = "" } = {}) {
  const m = CC_HEADER.exec(String(title))
  if (!m) return null                                       // не Conventional Commits → не гадаем
  if (m.groups.bang) return "major"                         // `!` побеждает тип
  if (/^BREAKING[ -]CHANGE:/im.test(String(body))) return "major"
  const type = m.groups.type.toLowerCase()
  if (type === "fix") return "patch"
  if (type === "feat") return "minor"
  return null            // chore/docs/refactor/test/… веса не несут → тега нет (см. также no-bump по diff)
}

// ── следующий тег ──
// Возвращает {tag, reason}; tag=null означает «тег не ставим» (с объяснимой причиной, не молча).
// Форма ПЕРВОГО тега: conform брать не у кого (тегов нет) — решение оператора: `v1.2.3`.
// Самая частая схема в живых репо; Go-модули без префикса `v` вообще не версионируются.
// Как только тег есть, форму диктует он (ниже) — этот дефолт работает ровно один раз.
export const DEFAULT_PREFIX = "v"

export function nextTag({ weight, files, tags, seed = "0.0.0" }) {
  if (!["patch", "minor", "major", "greenfield"].includes(weight)) {
    return { tag: null, reason: `weight='${weight ?? "нет"}' не бампается (chore/unclear версию не двигают; нет сигнала — @git-hand не протащил weight в PR)` }
  }
  if (!touchesProduct(files)) {
    return { tag: null, reason: `no-bump: ни один из ${(files || []).length} файлов diff'а не продуктовый (плумбинг)` }
  }
  // greenfield — первый релиз вертикали: версия не бампается от базы, а ОБЪЯВЛЯЕТСЯ как 1.0.0
  // (вертикаль встала целиком, контракт зафиксирован). Форму берём у репо, если теги уже есть.
  if (weight === "greenfield") {
    const prefix = latestRelease(tags)?.prefix ?? DEFAULT_PREFIX
    return { tag: `${prefix}1.0.0`, reason: "greenfield → 1.0.0 (первый релиз вертикали)" }
  }
  // Тегов нет → база = seed (0.0.0), и первый тег бампается ПО ВЕСУ, как любой другой:
  // patch→0.0.1 · minor→0.1.0 · major→1.0.0. Захардкоженный «0.1.0» игнорировал вес (баг).
  const base = latestRelease(tags) || { ...parseTag(seed), prefix: DEFAULT_PREFIX }
  const { prefix, major, minor, patch } = base
  // Форму нового тега диктует ПОСЛЕДНИЙ РЕЛИЗНЫЙ тег: репо уже сказало свою схему — следуем ей,
  // а не навязываем свою. Осознанный переход репо на другую форму подхватится сам (последний тег победит).
  const next = weight === "major" ? `${major + 1}.0.0`
             : weight === "minor" ? `${major}.${minor + 1}.0`
             : `${major}.${minor}.${patch + 1}`
  return { tag: prefix + next, reason: `${prefix}${major}.${minor}.${patch} + ${weight}` }
}

// Канарейка — pre-release X.Y.Z-canary.N до промоушена (patch-flow OQ-1/OQ-4: канарейка ВСЕГДА).
export function canaryTag(releaseTag, existingTags) {
  const esc = String(releaseTag).replace(/[.]/g, "\\.")
  const ns = (existingTags || [])
    .map((t) => new RegExp(`^${esc}-canary\\.(\\d+)$`).exec(String(t))?.[1])
    .filter(Boolean).map(Number)
  return `${releaseTag}-canary.${ns.length ? Math.max(...ns) + 1 : 1}`
}

// ── CLI-хвост (побочки здесь; всё выше — чистое) ────────────────────────────────
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())
if (isMain) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : undefined }
  const has = (n) => process.argv.includes(n)
  const lines = (s) => String(s).split("\n").map((x) => x.trim()).filter(Boolean)
  const git = (...a) => execFileSync("git", a, { encoding: "utf8" })

  let weight = arg("--weight")?.replace(/^weight[=:]\s*/i, "")   // defensive: `weight=patch` → `patch`
  if (!weight && (arg("--pr-title") || arg("--pr-body"))) {
    weight = weightFrom({
      title: arg("--pr-title") ? readFileSync(arg("--pr-title"), "utf8") : "",
      body: arg("--pr-body") ? readFileSync(arg("--pr-body"), "utf8") : "",
    })
  }
  const fromGit = has("--from-git")
  const tags = arg("--tags-from") ? lines(readFileSync(arg("--tags-from"), "utf8"))
             : fromGit ? lines(git("tag", "--list")) : []
  const files = arg("--files-from") ? lines(readFileSync(arg("--files-from"), "utf8"))
              : fromGit ? lines(git("diff", "--name-only", "HEAD~1", "HEAD")) : []

  if (has("--help") || (!weight && !fromGit && !arg("--files-from"))) {
    console.log([
      "ci/semver-bump.mjs — следующий SemVer-тег транка по весу задачи и diff'у PR.",
      "",
      "  node ci/semver-bump.mjs --weight <patch|minor|major|greenfield> --files-from <f> [--tags-from <f>] [--json]",
      "  node ci/semver-bump.mjs --pr-title <f> [--pr-body <f>] --files-from <f> --tags-from <f> [--json]",
      "  node ci/semver-bump.mjs --weight patch --from-git      # теги и diff HEAD~1..HEAD берёт сам",
      "",
      "Вывод: `<tag>\\t<причина>` либо `NO_TAG\\t<причина>`; --json → {tag,reason,form,weight,files}.",
      "Код возврата всегда 0 — «тег не нужен» это штатный исход, а не сбой.",
    ].join("\n"))
    process.exit(0)
  }

  const res = nextTag({ weight, files, tags })
  const form = res.tag && res.tag.startsWith("v") ? "v" : ""
  if (has("--json")) console.log(JSON.stringify({ ...res, form, weight, files: files.length }))
  else console.log(res.tag ? `${res.tag}\t${res.reason}` : `NO_TAG\t${res.reason}`)
  process.exit(0)   // no-bump — НЕ ошибка; CI различает по пустому tag, а не по коду возврата
}
