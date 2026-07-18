// Интерактивная настройка моделей тиров (large/medium/small) для раннера —
// пишет harness/models.config.json. Кросс-платформенно (Node, Win/macOS/Linux).
//
//   node harness/configure-models.mjs <claude|opencode|codex>
//
// Спрашивает три модели; Enter — оставить текущее значение; пустой ввод на пустом
// текущем — модель не задаётся (роль наследует модель пользователя раннера).
// Если stdin НЕ интерактивен (CI/смоук/пайп) — ничего не спрашивает и конфиг не трогает,
// чтобы установка не зависала. Пер-ролевые оверрайды (roles) не трогаются — правь вручную.

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs"
import { createInterface } from "node:readline"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { homedir } from "node:os"
import { loadModelsConfig, deriveTiersFromProvider } from "./lib/models-config.mjs"
import { validateModelBinding } from "./lib/validate-model-binding.mjs"

// Global opencode-конфиг (провайдеры) — для валидации связки тир→модель→провайдер.
function parseJsonc(text) {
  try { return JSON.parse(text) } catch { /* очистим комменты/хвост-запятые */ }
  try { return JSON.parse(text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1")) } catch { return null }
}
function loadGlobal() {
  const xdg = process.env.XDG_CONFIG_HOME || join(homedir(), ".config")
  const jsonc = join(xdg, "opencode", "opencode.jsonc"), json = join(xdg, "opencode", "opencode.json")
  const path = existsSync(jsonc) ? jsonc : (existsSync(json) ? json : jsonc)
  const cfg = existsSync(path) ? (parseJsonc(readFileSync(path, "utf8")) || {}) : {}
  return { path, cfg }
}

const runner = process.argv[2]
const ROOT = dirname(fileURLToPath(import.meta.url))
const CLONE_CONFIG = join(ROOT, "models.config.json")
// pristine-клон (T5): если задан локальный override RATIONALDEV_MODELS (ВНЕ клона) — правки моделей
// пишем ТУДА (клон остаётся чистым для `rationaldev update`); иначе — в клон (как раньше).
const OVERRIDE = process.env.RATIONALDEV_MODELS
const CONFIG = OVERRIDE || CLONE_CONFIG

const RUNNERS = ["claude", "opencode", "codex"]
if (!RUNNERS.includes(runner)) {
  console.error(`configure-models: неизвестный раннер '${runner}' (ожидается ${RUNNERS.join("/")})`)
  process.exit(1)
}

// База = клон-дефолт ← существующий override (сохраняем прежние правки при повторном запуске).
const cfg = loadModelsConfig(ROOT)
if (!cfg[runner]) cfg[runner] = { tiers: {}, roles: {} }
if (!cfg[runner].tiers) cfg[runner].tiers = {}

// #2+#3 (оба режима, ДО TTY-выхода): не молчать при висячей связке. Если тиры/роли не резолвятся к
// global-провайдеру И его можно однозначно вывести (единственный кастомный провайдер) — ДЕРИВИМ (клон-дефолт
// openrouter/* не доедет до проекций при чужом провайдере). Неоднозначно — ГРОМКОЕ предупреждение, не молча.
if (runner === "opencode") {
  const g = loadGlobal()
  const cur = { tiers: cfg.opencode.tiers, roles: cfg.opencode.roles || {} }
  if (!validateModelBinding(cur, g.cfg).ok) {
    const d = deriveTiersFromProvider(g.cfg)
    if (d) {
      cfg.opencode.tiers = { large: d.large, medium: d.small, small: d.small }
      for (const r of Object.keys(cfg.opencode.roles || {})) cfg.opencode.roles[r] = d.large  // роль-оверрайды были на large-модели
      mkdirSync(dirname(CONFIG), { recursive: true })
      writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + "\n")
      console.log(`  ✓ модели тиров выведены из провайдера '${d.provider}' (клон-дефолт не подходил): large=${d.large} · small=${d.small} → ${OVERRIDE ? "override" : "models.config.json"}`)
    } else {
      console.error(`  ⚠ модели тиров ссылаются на провайдера, которого НЕТ в global (~/.config/opencode) — opencode-агенты не запустятся.`)
      console.error(`    Авто-вывод невозможен (0 или >1 кастомных провайдеров с моделями). Настрой провайдера (setup-opencode) или запусти configure-models интерактивно.`)
    }
  }
}

// Не интерактивно (нет TTY) — дерив/предупреждение выше уже сделаны; тихо выходим (без диалога).
if (!process.stdin.isTTY) process.exit(0)

const tiers = cfg[runner].tiers
const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = (label, def) =>
  new Promise((res) =>
    rl.question(`  ${label}${def ? ` [${def}]` : " (Enter — наследовать)"}: `, (a) => res(a.trim() || def || "")),
  )

console.log(`\nНазначение моделей для раннера '${runner}' — ДВА тира (harness/models.config.json).`)
console.log("Имена произвольны — модель твоего провайдера. Enter оставляет текущее значение.")
console.log("large = суждение (планирование/ревью/приёмка) · small = исполнение (реализация/тесты/git).\n")

// Два тира: large (суждение) + small (исполнение); medium схлопывается в small.
// Цикл: после ввода валидируем связку с global-провайдером. Висячая ссылка (opencode
// молча не вызовет агента) → [a] дописать модель в global · [r] выбрать заново · [i] игнор.
let large, small
for (;;) {
  large = await ask("large — суждение", tiers.large)
  small = await ask("small — исполнение", tiers.small || tiers.medium)
  const candidate = { tiers: { large, medium: small, small }, roles: cfg[runner].roles || {} }
  const g = loadGlobal()
  const { ok, missing } = validateModelBinding(candidate, g.cfg)
  if (ok || runner !== "opencode") break   // валидируем провайдер-связку только для opencode-раннера
  console.log("\n  ⚠ Висячие ссылки — opencode не сможет вызвать агентов:")
  for (const m of missing) console.log(`    ✗ ${m.role} → ${m.model}: ${m.reason}`)
  const act = (await ask("  [a] дописать модель в global · [r] выбрать заново · [i] игнорировать (на свой риск)", "r")).toLowerCase()
  if (act.startsWith("i")) break
  if (act.startsWith("a")) {
    let wrote = false
    for (const m of missing) {
      if (!m.provider) { console.log(`    — ${m.model}: без провайдер-префикса, добавить нельзя — исправь имя модели.`); continue }
      const p = g.cfg.provider && g.cfg.provider[m.provider]
      if (!p) { console.log(`    — провайдер '${m.provider}' отсутствует в global — добавь через setup-opencode (baseURL/ключ).`); continue }
      const isCustom = !!(p.options && typeof p.options.baseURL === "string" && p.options.baseURL)
      if (!isCustom) continue   // registry-провайдер знает модель из реестра — писать нечего
      const modelId = m.model.slice(m.model.indexOf("/") + 1)
      const name = await ask(`    '${modelId}' name (человекочитаемое)`, modelId)
      const context = parseInt(await ask("    limit.context", "250144"), 10)
      const output = parseInt(await ask("    limit.output", "8192"), 10)
      p.models = { ...(p.models || {}), [modelId]: { name, limit: { context, output } } }
      wrote = true
    }
    if (wrote) { mkdirSync(dirname(g.path), { recursive: true }); writeFileSync(g.path, JSON.stringify(g.cfg, null, 2) + "\n"); console.log(`    ✓ global обновлён: ${g.path}`) }
    // повторный проход цикла — ре-валидация
  }
  // r (или после a) → следующая итерация
}
rl.close()

cfg[runner].tiers = { large, medium: small, small }   // medium = small (2-тира-модель)
mkdirSync(dirname(CONFIG), { recursive: true })
writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + "\n")

const show = (v) => (v ? v : "(наследует модель пользователя)")
console.log(`\n${OVERRIDE ? "override" : "models.config.json"} обновлён для '${runner}' (2 тира):`)
console.log(`  large=${show(large)}  small=${show(small)}  (medium=small)`)
